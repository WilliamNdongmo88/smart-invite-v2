const { createCheckin, getCheckinByInvitationId, updateCheckin, getEventAndGuestInfoByGuestId, getEventAndGuestInfoByGuestIds } = require("../models/checkins");
const { getEventScheduleByEventId } = require("../models/event_schedules");
const { getEventById, getUserByEventId } = require("../models/events");
const { getGuestById, getEventByGuestId, updateRsvpStatusGuest, getAllPresentGuest } = require("../models/guests");
const { getInvitationById, getGuestInvitationByToken } = require("../models/invitations");
const { createNotification } = require("../models/notification");
const { getUserById } = require("../models/users");
const { validateAndUseInvitation } = require("../services/invitation.service");
const { sendGuestPresenceToOrganizer, sendThankYouMailToPresentGuests, manualSendThankYouMailToPresentGuests } = require("../services/notification.service");
const schedule = require('node-schedule');
const { sendThankYouWhatsappToPresentGuests, manualSendThankYouWhatsappToPresentGuests, whatsappGuestPresenceToOrganizer } = require("../services/whatsapp.service");

// Map anti-doublon de jobs par eventId
const scheduledJobs = new Map();

const addCheckIn = async (req, res, next) => {
    try {
        const { eventId, invitationId, guestId, token, scannedBy, scanStatus, checkinTime } = req.body;

        if (!eventId || !invitationId || !guestId) {
            return res.status(400).json({ error: "Paramètres manquants." });
        }
        if (!token || token === 'undefined:undefined') {
            return res.status(400).json({ error: "Token invalide." });
        }

        // PERF B1+B2+B3 : regroupement des requêtes critiques — tout ce qui est
        // nécessaire pour répondre au client est exécuté en parallèle
        const [existingInvitation, existing] = await Promise.all([
            getGuestInvitationByToken(token),
            getCheckinByInvitationId(invitationId)
        ]);

        if (existingInvitation.length === 0) {
            return res.status(404).json({ error: "Code QR invalide !" });
        }

        if (existing) {
            // Scan dupliqué — mise à jour et réponse immédiate
            await updateCheckin(existing.id, eventId, invitationId, scannedBy, 'DUPLICATE', checkinTime);
            return res.status(409).json({ error: "Code QR déjà utilisé !" });
        }

        // PERF B1 : vérifications critiques en parallèle
        const [event, invitation] = await Promise.all([
            getEventById(eventId),
            getInvitationById(invitationId)
        ]);

        if (!event) return res.status(404).json({ error: "Événement non trouvé !" });
        if (!invitation) return res.status(404).json({ error: "Invitation non trouvée !" });
        if (invitation[0].status === 'USED') return res.status(409).json({ error: "Code QR déjà utilisé !" });

        const checkin = await createCheckin(eventId, guestId, invitationId, scannedBy, scanStatus, checkinTime);
        if (!checkin) return res.status(500).json({ error: "Erreur lors du check-in." });

        // PERF B5 : validateAndUseInvitation + updateRsvpStatusGuest en parallèle
        await Promise.all([
            validateAndUseInvitation(invitation),
            updateRsvpStatusGuest(guestId, 'present')
        ]);

        // Données minimales pour la réponse au client
        const event_and_guest_datas = await getEventAndGuestInfoByGuestId(guestId);

        // PERF B1 (critique) : on répond au client IMMÉDIATEMENT
        // Les notifications, emails, WhatsApp et scheduling sont déportés en arrière-plan
        res.status(201).json(event_and_guest_datas);

        // --- TÂCHES EN ARRIÈRE-PLAN (fire-and-forget) ---
        // Ces tâches s'exécutent APRÈS que la réponse HTTP a été envoyée.
        // Elles ne bloquent plus le scan.
        setImmediate(() => runPostCheckinTasks(eventId, guestId, event, checkinTime));

    } catch (error) {
        next(error);
    }
};

/**
 * PERF B1 : toutes les tâches non critiques pour l'UX de scan
 * sont exécutées ici, après la réponse HTTP.
 * Gain estimé : 1 à 5 secondes sur le temps de réponse perçu.
 */
async function runPostCheckinTasks(eventId, guestId, event, checkinTime) {
    try {
        const [guest, eventByGuest] = await Promise.all([
            getGuestById(guestId),
            getEventByGuestId(guestId)
        ]);

        const organizer = await getUserById(eventByGuest[0].organizerId);

        // PERF B2+B4 : notification + envoi présence en parallèle
        await Promise.all([
            createNotification(
                eventByGuest[0].eventId,
                `Arrivée Invité ${guest.full_name}`,
                `L'invité ${guest.full_name} vient d'arriver.`,
                'info',
                false
            ),
            organizer.notification_mode === 'email'
                ? sendGuestPresenceToOrganizer(organizer, guest)
                : whatsappGuestPresenceToOrganizer(organizer, guest)
        ]);

        // PERF B3 : scheduling en arrière-plan
        const user = await getUserByEventId(eventId);
        if (user.thank_notifications) {
            const schedules = await getEventScheduleByEventId(eventId);
            if (!schedules.executed && process.env.NODE_ENV !== 'test') {
                planSchedule(eventByGuest[0], schedules, organizer, guest);
            }
        }
    } catch (err) {
        // Les erreurs post-réponse sont loggées mais n'affectent pas le client
        console.error('❌ [runPostCheckinTasks] Erreur arrière-plan :', err.message);
    }
}

const getValidCheckIn = async (req, res, next) => {
    try {
        const { guestIds } = req.body;
        if (!Array.isArray(guestIds) || guestIds.length === 0) {
            return res.status(400).json({ error: "guestIds invalide ou vide" });
        }
        const event_and_guest_datas = await getEventAndGuestInfoByGuestIds(guestIds);
        if (event_and_guest_datas.length === 0) {
            return res.status(404).json({ error: "Aucun invité trouvé" });
        }
        return res.status(200).json(event_and_guest_datas);
    } catch (error) {
        console.error('GET CHECKIN ERROR:', error);
        next(error);
    }
};

function planSchedule(event, schedules, organizer, guest) {
    const date = formatDate(schedules.scheduled_for);
    const job = schedule.scheduleJob(date, async () => {
        await sendScheduledThankMessage(event, schedules, organizer, guest);
        scheduledJobs.delete(event.eventId);
    });
    scheduledJobs.set(event.eventId, job);
}

async function sendScheduledThankMessage(event, schedules, organizer, guest) {
    try {
        const guests = await getAllPresentGuest(guest.id);
        if (!guests || guests.length === 0) return;
        await Promise.all(
            guests.map(g => {
                if (g.notification_mode === 'email') return sendThankYouMailToPresentGuests(event, schedules, organizer, g);
                if (g.notification_mode === 'whatsapp') return sendThankYouWhatsappToPresentGuests(event, schedules, organizer, g);
                return Promise.resolve();
            })
        );
    } catch (error) {
        console.error("Erreur lors de l'envoi du message planifié:", error);
    }
}

async function sendManualThankMessage(req, res, next) {
    try {
        const { eventId, guests, message } = req.body.datas;
        await Promise.all([
            ...guests.map(g => {
                if (g.notification_mode === 'email') return manualSendThankYouMailToPresentGuests(eventId, message, g);
                if (g.notification_mode === 'whatsapp') return manualSendThankYouWhatsappToPresentGuests(eventId, message, g);
                return Promise.resolve();
            }),
            createNotification(
                eventId,
                `Message de remerciement envoyé`,
                `Le message de remerciement a été envoyé à tous les invités présents.`,
                'info',
                false
            ),
        ]);
        return res.status(200).json({ message: "Message de remerciement envoyé avec succès" });
    } catch (error) {
        console.error("Erreur lors de l'envoi du message:", error);
        next(error);
    }
}

/**
 * Ajoute exactement 1 jour (86 400 000 ms) en UTC pur.
 */
// function formatDate(iso) {
//     return new Date(new Date(iso).getTime() + 86_400_000);
// }
function formatDate(iso){
    let d = new Date(iso);

    // Ajouter 1 jour
    d.setDate(d.getDate() + 1);

    // Maintenant on décompose
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0–11
    const day = d.getUTCDate();
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const seconds = d.getUTCSeconds();

    const result = new Date(year, month, day, hours, minutes, seconds);

    return result;
}

module.exports = { addCheckIn, sendScheduledThankMessage, getValidCheckIn, sendManualThankMessage };
