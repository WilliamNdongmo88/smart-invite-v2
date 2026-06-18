const { createCheckin, getCheckinByInvitationId, updateCheckin, getEventAndGuestInfoByGuestId } = require("../models/checkins");
const { getEventScheduleByEventId } = require("../models/event_schedules");
const { getEventById, getUserByEventId } = require("../models/events");
const { getGuestById, getEventByGuestId, updateRsvpStatusGuest, getAllPresentGuest } = require("../models/guests");
const { getInvitationById, getGuestInvitationByToken } = require("../models/invitations");
const { createNotification } = require("../models/notification");
const { getUserById } = require("../models/users");
const { validateAndUseInvitation } = require("../services/invitation.service");
const { sendGuestPresenceToOrganizer,sendThankYouMailToPresentGuests, manualSendThankYouMailToPresentGuests
      } = require("../services/notification.service");
const schedule = require('node-schedule');
const axios = require('axios');
const { sendThankYouWhatsappToPresentGuests, 
        manualSendThankYouWhatsappToPresentGuests, 
        whatsappGuestPresenceToOrganizer
      } = require("../services/whatsapp.service");

const viewPdfInvitation = async (req, res, next) => {
  try {
    //console.log('qrCodes:', req.body.link);
    const pdfUrl = req.body.link;

    const response = await axios.get(pdfUrl, {
      responseType: "arraybuffer"
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=invitation.pdf");

    res.send(response.data);
  } catch (error) {

    if (error.response) {
      // 👉 Le serveur a répondu avec un status ≠ 200
      console.error("❌ Axios error response:");
      console.error("Status :", error.response.status);
      console.error("Headers :", error.response.headers);
      console.error("Data :", error.response.data?.toString());

    } else if (error.request) {
      // 👉 La requête a été envoyée mais aucune réponse
      console.error("❌ Axios no response:");
      console.error(error.request);

    } else {
      // 👉 Erreur avant l’envoi (config, URL, etc.)
      console.error("❌ Axios setup error:");
      console.error(error.message);
    }

    throw error; // important pour ne pas masquer l’erreur
  }
};


const addCheckIn = async (req, res, next) => {
    try {
        //console.log("###body: ", req.body);
        let isValid = false;
        const {eventId, invitationId, guestId, token, scannedBy, scanStatus, checkinTime} = req.body;
        if(token=='undefined:undefined') return res.status(404).json({error: "Code Qr invalide !"});
        const existingInvitation = await getGuestInvitationByToken(token);
        if(existingInvitation.length==0) return res.status(404).json({error: "Code Qr invalide !"});
        const existing = await getCheckinByInvitationId(invitationId);
        if (!existing) {
            const event = await getEventById(eventId);
            if(!event) return res.status(404).json({error: "Event non trouvé !"});
            const invitation = await getInvitationById(invitationId);
            if(!invitation) return res.status(404).json({error: "Invitation non trouvé !"});
            if(invitation[0].status=='USED') return res.status(409).json({error: "Code Qr déjà utilisé !"});
            const checkin = await createCheckin(eventId, guestId, invitationId, scannedBy, scanStatus, checkinTime);
            if (checkin) {
                await validateAndUseInvitation(invitation);
                await updateRsvpStatusGuest(guestId, 'present');
                isValid = true;
            }
            if (isValid) {
                const guest = await getGuestById(guestId);
                const event = await getEventByGuestId(guestId);
                const organizer = await getUserById(event[0].organizerId);
                if(organizer.notification_mode === 'email') {
                    await sendGuestPresenceToOrganizer(organizer, guest);
                }
                if(organizer.notification_mode === 'whatsapp') {
                    await whatsappGuestPresenceToOrganizer(organizer, guest);
                }
                await createNotification(
                    event[0].eventId,
                    `Arrivé Invité ${guest.full_name}`,
                    `L'invité ${guest.full_name} vient d'arriver.`,
                    'info',
                    false
                );
                // Planification (Sensé s'exécuter le lendemain du jour de l'événement)
                const user = await getUserByEventId(eventId);
                if(user.thank_notifications){
                  const schedules = await getEventScheduleByEventId(eventId);
                  //console.log('Executed ? ', schedules.executed);
                  if (!schedules.executed && process.env.NODE_ENV !== 'test') {
                      planSchedule(event[0], schedules, organizer, guest);
                  }
                }
            }
            const event_and_guest_datas = await getEventAndGuestInfoByGuestId(guestId);
            //console.log('event_and_guest_datas:', event_and_guest_datas);
            return res.status(201).json(event_and_guest_datas);
        } else {
            let checkinId = existing.id;
            existing.scan_status = 'DUPLICATE';
            await updateCheckin(checkinId, eventId, invitationId, scannedBy, existing.scan_status, checkinTime);
            return res.status(409).json({error: "Code Qr déjà utilisé !"});
        }
    } catch (error) {
        //console.log('ADD CHECKIN ERROR:', error.message);
        next(error)
    }
}

const getValidCheckIn = async (req, res, next) => {
  try {
    const { guestIds } = req.body;

    //console.log("GuestIds reçus :", guestIds);

    if (!Array.isArray(guestIds) || guestIds.length === 0) {
      return res.status(400).json({ error: "guestIds invalide ou vide" });
    }

    let event_and_guest_datas = [];

    for (const guestId of guestIds) {
      const data = await getEventAndGuestInfoByGuestId(guestId);
      if (data) event_and_guest_datas.push(data);
    }

    if (event_and_guest_datas.length === 0) {
      return res.status(404).json({ error: "Aucun invité trouvé" });
    }

    return res.status(200).json(event_and_guest_datas);

  } catch (error) {
    console.error('GET CHECKIN ERROR:', error);
    next(error);
  }
};

// Planifier la tâche
function planSchedule(event, schedules, organizer, guest) {
    //console.log('[schedule 2]scan date:', schedules.scheduled_for);
    const date = formatDate(schedules.scheduled_for);
    
    // on passe une fonction anonyme qui appelle notre fonction async
    // const user = getUserByEventId(event.eventId);
    // if(user.thank_notifications){}
    schedule.scheduleJob(date, async () => {
        //console.log('=== Job déclenché ===');
        await sendScheduledThankMessage(event, schedules, organizer, guest);
    });
}

async function sendScheduledThankMessage(event, schedules, organizer, guest) {
    try {
        //console.log('[2] guest.rsvpStatus:', guest.rsvp_status);
        const guests = await getAllPresentGuest(guest.id);
        if (!guests || guests.length === 0) {
            //console.log("Aucun invité présent trouvé.");
            return;
        }
        // Envoi des mails en parallèle contrôlée (plus rapide)
        await Promise.all(
            guests.map(g => {
                if(g.notification_mode === 'email') return sendThankYouMailToPresentGuests(event, schedules, organizer, g);
                if(g.notification_mode === 'whatsapp') return sendThankYouWhatsappToPresentGuests(event, schedules, organizer, g);
                return Promise.resolve();
            })
        );
    } catch (error) {
        console.error("Erreur lors de l'envoi du mail:", error);
    }
}

async function sendManualThankMessage(req, res, next) {
    try {
        //console.log('Body:', req.body.datas);
        const {eventId, guests, message} = req.body.datas;
        // Envoi des mails en parallèle contrôlée (plus rapide)
        await Promise.all(
            guests.map(g => {
                if(g.notification_mode === 'email') return manualSendThankYouMailToPresentGuests(eventId, message, g);
                if(g.notification_mode === 'whatsapp') return manualSendThankYouWhatsappToPresentGuests(eventId, message, g);
                return Promise.resolve();
            }),
              await createNotification(
                eventId,
                `Message de remerciement envoyé`,
                `Le message de remerciement a été envoyé à tous les invités presents.`,
                'info',
                false
            ),
        );
        return res.status(200).json({message: "Message de remerciement envoyé avec succès"})
    } catch (error) {
        console.error("Erreur lors de l'envoi du mail:", error);
        next(error)
    }
}

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

module.exports = {addCheckIn, sendScheduledThankMessage, 
    getValidCheckIn, sendManualThankMessage, viewPdfInvitation};