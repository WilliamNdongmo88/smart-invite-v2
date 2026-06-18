const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getGuestById, updateRsvpStatusGuest, getGuestAndEventRelatedById, getEventByGuestId} = require("../models/guests");
const {createInvitation, getGuestInvitationById, 
    getGuestInvitationByToken, deleteGuestInvitation,
    getUserRoleByToken,
    updateInvitationQrCode} = require('../models/invitations');
const { createNotification } = require('../models/notification');
const { generateGuestQr, getLogoUrlFromFirebase, generateAttendeeQr } = require("../services/qrCodeService");
const { generateGuestPdf, uploadPdfToFirebase } = require("../services/pdfService");
const {deleteGuestFiles} = require('../services/invitation.service');
const {sendGuestEmail} = require('../services/notification.service');
const {sendGuestWhatsapp} = require('../services/whatsapp.service');
const { update_guest } = require('../models/guests');
const { bucket } = require('../config/firebaseConfig');
const { getEventById } = require('../models/events');
const { getEventInvitNote } = require('../models/event_invitation_notes');
const { isPaymentValidated, incrementSentInvitations } = require('../models/payment');

const genererSeveralInvitations = async (req, res, next) => {

    try {

        const guestsIdList = req.body;
        if (!Array.isArray(guestsIdList) || guestsIdList.length === 0) {
            return res.status(400).json({
                error: "Liste vide"
            });
        }

        const results = [];
        for (const guestId of guestsIdList) {
            try {
                /**
                 * =========================
                 * 1. VALIDATIONS
                 * =========================
                 */
                const guest = await getGuestById(guestId);
                if (!guest) {
                    results.push({ guestId, success: false, error: `Invité ${guestId} introuvable` });
                    continue;
                }

                const guestEvent = await getGuestAndEventRelatedById(guestId);
                if (!guestEvent?.[0]?.event_title) {
                    results.push({ guestId, success: false, error: "Données événement introuvables" });
                    continue;
                }

                const existingInvitation = await getGuestInvitationById(guestId);
                if (existingInvitation?.[0]) {
                    results.push({ guestId, success: false, error: "Invitation déjà générée" });
                    continue;
                }

                /**
                 * =========================
                 * 2. TOKEN
                 * =========================
                 */
                const token = `${guestId}:${uuidv4()}`;

                /**
                 * =========================
                 * 3. CREATE INVITATION
                 * =========================
                 */
                const invitationId = await createInvitation( guestId, token, null);
                if (!invitationId) {
                    throw new Error( "Erreur création invitation" );
                }

                /**
                 * =========================
                 * 4. QR CODE
                 * =========================
                 */
                const qrUrl = await generateGuestQr( guest.id, token, "wedding-ring.webp" );
                await updateInvitationQrCode( guest.id, qrUrl );

                /**
                 * =========================
                 * 5. PDF
                 * =========================
                 */
                const event = await getEventByGuestId(guest.id);
                const card = await getEventInvitNote( event[0].eventId );

                let pdfUrl = card?.pdf_url || null;
                let pdfBuffer = null;

                if (!pdfUrl) {
                    pdfBuffer = await generateGuestPdf( guestEvent[0], card );
                    const uploaded = await uploadPdfToFirebase( guest, pdfBuffer, null);
                    pdfUrl = uploaded?.url || null;
                }

                /**
                 * =========================
                 * 6. NOTIFICATIONS
                 * =========================
                 */
                if (guest.notification_mode === 'email') {
                    await sendGuestEmail( guest, guestEvent[0], token);
                }

                if (guest.notification_mode === 'whatsapp') {
                    await sendGuestWhatsapp( guest, guestEvent[0], token);
                }

                // Incrément APRÈS envoi WhatsApp confirmé
                await incrementSentInvitations(event[0].eventId);

                /**
                 * =========================
                 * 7. SUCCESS
                 * =========================
                 */
                results.push({ guestId, success: true, message: "Invitation générée", qrUrl, pdfUrl});
            } catch (error) {
                console.error(`GENERATE INVITATION ERROR [${guestId}] :`,error.message);
                results.push({ guestId, success: false, error: error.message });
            }
        }
        return res.status(200).json(results);
    } catch (error) {
        console.error( "GENERATE SEVERAL INVITATIONS ERROR:", error.message);
        next(error);
    }
};

const genererInvitation = async ( req, res, next ) => {
    let invitationId = null;
    try {
        /**
         * =====================================================
         * 1. VALIDATION
         * =====================================================
         */
        const guestId = Number(req.params.guestId);
        if (!guestId || isNaN(guestId)) {
            return res.status(400).json({
                error: 'ID invité invalide'
            });
        }

        /**
         * =====================================================
         * 2. RECUPERATION INVITE
         * =====================================================
         */
        const guest = await getGuestById(guestId);

        if (!guest) {
            return res.status(404).json({
                error: 'Invité introuvable'
            });
        }

        /**
         * =====================================================
         * 3. VERIFICATION INVITATION EXISTANTE
         * =====================================================
         */
        const invitations = await getGuestInvitationById( guestId );
        if (invitations[0]) {
            return res.status(409).json({ error: 'Invitation déjà envoyée à cet invité' });
        }

        /**
         * =====================================================
         * 4. RECUPERATION DONNEES EVENT
         * =====================================================
         */
        const guestEvent = await getGuestAndEventRelatedById( guestId );
        if ( !guestEvent || !guestEvent[0] ) {
            return res.status(404).json({
                error: 'Données événement introuvables'
            });
        }
        const eventData = guestEvent[0];
        if (!eventData.event_title) {
            return res.status(404).json({
                error: 'Titre événement introuvable'
            });
        }

        /**
         * =====================================================
         * 5. RECUPERATION EVENT + CARD
         * =====================================================
         */
        const event = await getEventByGuestId( guest.id );
        //console.log("#EVENT :0: ", event);
        if (!event[0]) {
            return res.status(404).json({
                error: 'Evénement introuvable'
            });
        }
        const card = await getEventInvitNote( event[0].eventId );

        /**
         * =====================================================
         * 6. CREATION TOKEN
         * =====================================================
         */
        const token = `${guestId}:${uuidv4()}`;

        /**
         * =====================================================
         * 7. CREATION INVITATION EN BASE
         * =====================================================
         */
        //console.log("---Création invitation pour guestId---");
        invitationId = await createInvitation( guestId, token, null );
        if (!invitationId) {
            throw new Error(
                'Erreur création invitation'
            );
        }

        /**
         * =====================================================
         * 8. GENERATION QR CODE
         * =====================================================
         */
        let qrUrl = null;
        try {
            qrUrl = await generateGuestQr( guest.id, token, 'wedding-ring.webp' );
            if (!qrUrl) {
                throw new Error( 'QR Code non généré' );
            }
        } catch (error) {
            console.error('QR ERROR:', error.message);
            await deleteInvitation( invitationId );
            throw error;
        }

        /**
         * =====================================================
         * 9. UPDATE QR CODE URL
         * =====================================================
         */
        const invitationUpdated = await updateInvitationQrCode( guest.id, qrUrl );
        // //console.log("###invitationUpdated:", invitationUpdated);
        /**
         * =====================================================
         * 10. GENERATION PDF
         * =====================================================
         */
        let pdfBuffer = null;
        let pdfUrl = null;
        try {
            if (card.pdf_url) {
                pdfUrl = card.pdf_url;
            } else {
                pdfBuffer = await generateGuestPdf( eventData, card );
                const uploadedFile = await uploadPdfToFirebase( guest, pdfBuffer, null );
                pdfUrl = uploadedFile?.url || null;
            }
        } catch (error) {
            console.error( 'PDF ERROR:', error.message );
        }

        /**
         * =====================================================
         * 11. ENVOI EMAIL / WHATSAPP
         * =====================================================
         */
        try {
            switch (guest.notification_mode) {
                case 'email':
                    await sendGuestEmail( guest, eventData, token );
                    break;
                case 'whatsapp':
                    await sendGuestWhatsapp( guest, eventData, token );
                    break;
                case 'both':
                    await sendGuestEmail( guest, eventData, token );
                    await sendGuestWhatsapp( guest, eventData, token );
                    break;
                default:
                    //console.log('Aucun mode notification défini');
                    break;
            }
        } catch (error) {
            console.error('#3#NOTIFICATION ERROR:', error.message );
        }

        /**
         * =====================================================
         * 12. NOTIFICATION ORGANISATEUR
         * =====================================================
         */
        try {
            // Incrément APRÈS envoi WhatsApp confirmé
            console.log("---Incrément APRÈS envoi WhatsApp confirmé---");
            await incrementSentInvitations(event[0].eventId);
            await createNotification(
                event[0].eventId,
                'Invitation envoyée',
                `L'invitation a été envoyée à ${guest.full_name}.`,
                'info',
                false
            );

        } catch (error) {

            console.error(
                'NOTIFICATION DB ERROR:',
                error.message
            );
        }

        /**
         * =====================================================
         * 13. SUCCESS RESPONSE
         * =====================================================
         */
        return res.status(201).json({success:'Invitation générée avec succès', invitationId, qrUrl, pdfUrl });
    } catch (err) {
        console.error(
            'ERREUR GENERATION INVITATION :', err.message
        );
        return next(err);
    }
};

const generateAttendeeQrCode = async (req, res, next) => {
    try {
        //console.log('### body: ', req.body);
        const {logoFileName, attendeeId} = req.body;
        let token = `attId-${attendeeId}` +uuidv4();
        const qrUrl = await generateAttendeeQr(attendeeId, token, logoFileName);
        //console.log('### qrCode_Url: ', qrUrl);
        return res.json({ qrUrl });
    } catch (error) {
        console.error("Erreur génération :", err.message);
        next(err)
    }
}

const viewInvitation = async (req, res, next) => {
    try {
        const guest = await getGuestById(req.params.guestId);
        //console.log('[viewInvitation] guest:', guest);
        if (!guest) return res.status(404).send("Invité introuvable");

        const invitations = await getGuestInvitationById(req.params.guestId);
        if (!invitations[0]) return res.status(401).json({ error: "Aucune invitation n'a été envoyé a cet invité" });

        const file = bucket.file(`pdfs/carte_${guest.id}.pdf`);
        const [exists] = await file.exists();

        if (exists) {
            // Sert le PDF déjà généré
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", "inline; filename=invitation.pdf");
            file.createReadStream().pipe(res);
        } else {
            // Sinon, génère et renvoie à la volée
            const event = await getEventByGuestId(guest.id);
            const card = await getEventInvitNote(event[0].eventId);
            let pdfUrl = '';
            if(card.pdf_url == null){
                const buffer = await generateGuestPdf(guest, card);
                data = await uploadPdfToFirebase(guest, buffer);
                pdfUrl = data.url;
            }else{
                pdfUrl = card.pdf_url;
            }
            //console.log('pdfUrl:', pdfUrl);
            res.redirect(pdfUrl);
        }
    } catch (error) {
        console.error("Erreur affichage carte:", error);
        next(error);
    }
}

const viewQrCode = async (req, res, next) => {
    try {
        const result = await getGuestInvitationByToken(req.params.token);
        if(!result) return res.status(401).json({error: `Aucun invité trouvé`});
        const logoMap = {
            'wedding':     'carte.jpg',
            'engagement':  'carte-fiancailles.png',
            'anniversary': 'carte-anniv-mariage.png',
            'birthday':    'carte-anniv.png'
        };

        let eventType = null;
        if (result[0] && result[0].length !== 0) {
            const guestId = req.params.token.split(':')[0];
            const event = await getEventByGuestId(guestId);
            if (!event?.[0]) return res.status(404).json({ error: 'Événement introuvable' });
            eventType = event[0].type;
        } else {
            const eventId = req.params.token.split(':')[0];
            const event = await getEventById(eventId);
            if (!event) return res.status(404).json({ error: 'Événement introuvable' });
            eventType = event.type;
        }

        const fileName = logoMap[eventType] || null;
        const imageUrl = fileName ? await getLogoUrlFromFirebase(fileName) : '';
        return res.status(200).json({ imageUrl });
    } catch (error) {
        console.error('GET INVITATION ERROR:', error.message);
        next(error);
    }
};

const downloadQRCode = async (req, res, next) => {
    try {
        const response = await axios.get(req.query.url, { responseType: "arraybuffer" });
        const guest = await getGuestById(req.params.guestId);
        if (!guest) return res.status(404).json({ error: "Invité introuvable" });
        //console.log('[downloadQRCode] guest:', guest);
        res.set({
            "Content-Type": "image/png",
            "Content-Disposition": `attachment; filename="qr-code-${guest.full_name.replace(' ','_')}.png"`
        });

        res.send(response.data);
    } catch (error) {
        console.error('[downloadQRCode] ERROR:', error.message);
        next(error);
    }
};

const rsvpGuestStatus = async (req, res, next) => {
    try {
        const {rsvpStatus} = req.body;
        const invitation = await getGuestInvitationByToken(req.params.token);
        // //console.log('invitation:', invitation);
        if(!invitation[0]) return res.status(404).json({error: "Invitation non trouvé"});
        await updateRsvpStatusGuest(invitation[0].guest_id, rsvpStatus.toUpperCase());
        return res.status(200).json({message: "Rsvp Status mis a jous avec succès!"});
    } catch (error) {
        console.error('RSVP STATUS GUEST ERROR:', error.message);
        next(error);
    }
};

const deleteInvitation = async (req, res, next) => {
    try {
        const invitation = await getGuestInvitationById(req.params.guestId);
        if(!invitation[0]) return res.status(404).json({error: "Invitation non trouvé!"});
        const guest = await getGuestById(req.params.guestId);
        //console.log('guest before delete invitation:', guest);
        if(guest.has_plus_one){
            //console.log("guest: ", guest);
            guest.has_plus_one = false;
            guest.plus_one_name = null;
            guest.plus_one_name_diet_restr = null;
            guest.guest_has_plus_one_autorise_by_admin = false;
            guest.rsvp_status = 'pending';
            await update_guest(guest.id, guest.event_id, guest.full_name, null, guest.email, 
                guest.phone_number, guest.notification_mode, guest.rsvp_status, 
                guest.has_plus_one, guest.guest_has_plus_one_autorise_by_admin, guest.plus_one_name, guest.notes, guest.dietary_restrictions, 
                guest.plus_one_name_diet_restr, guest.updated_at);
        }else if(guest.rsvp_status == 'confirmed' || guest.rsvp_status == 'declined'){
            guest.has_plus_one = false;
            guest.plus_one_name = null;
            guest.plus_one_name_diet_restr = null;
            guest.rsvp_status = 'pending';
            await update_guest(guest.id, guest.event_id, guest.full_name, guest.table_number, guest.email, 
                guest.phone_number, guest.notification_mode, guest.rsvp_status, guest.has_plus_one, 
                guest.guest_has_plus_one_autorise_by_admin, guest.plus_one_name, guest.notes, 
                guest.dietary_restrictions, guest.plus_one_name_diet_restr, guest.updated_at);
        }
        await deleteGuestInvitation(req.params.guestId);
        await deleteGuestFiles(req.params.guestId, invitation[0].token);
        return res.status(200).json({message: "Invitation supprimé avec succès"});
    } catch (error) {
        console.error('DELETE INVITATION ERROR:', error.message);
        next(error);
    }
}

module.exports = {genererInvitation, genererSeveralInvitations, viewInvitation, viewQrCode, 
                    rsvpGuestStatus, deleteInvitation, downloadQRCode, generateAttendeeQrCode
                };
