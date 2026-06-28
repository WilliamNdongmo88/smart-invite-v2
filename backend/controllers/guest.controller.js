const { v4: uuidv4 } = require('uuid');
const pool = require('../config/bd');

const { getEventById, getGuestEmailRelatedToEvent,getUserByEventId, 
        getGuestPhoneRelatedToEvent,getUserByEvtId} = require('../models/events');
const { deleteGuestFiles } = require('../services/invitation.service');
const { getGuestInvitationById, createInvitation, updateInvitationQrCode } = require('../models/invitations');
const { sendInvitationToGuest, sendReminderMail,
    sendGuestResponseToOrganizer, sendFileQRCodeMail,
    sendPdfToGuestMail} = require('../services/notification.service');
const { generateGuestQr } = require("../services/qrCodeService");
const { generateGuestPdf, uploadPdfToFirebase } = require("../services/pdfService");
const {
        createGuest, getGuestById, getAllGuestAndInvitationRelatedByEventId,
        update_guest, updateRsvpStatusGuest, delete_guest,
        getAllGuestAndInvitationRelated,getGuestAndInvitationRelatedById,
        getEventByGuestId,
        createGuestFromLink,
        getGuestAndEventRelatedById,
        getAllConfirmedGuests
    } = require('../models/guests');
const { getUserById } = require('../models/users');
const { createNotification } = require('../models/notification');
const { getLinkByToken, updateLink, updateLinkUsedCount } = require('../models/links');
const { getEventInvitNote } = require('../models/event_invitation_notes');
const { getAllUsers } = require('./feedback.controller');
const { whatsappInvitationToGuest, sendFileQRCodeWhatsapp, 
        sendReminderWhatsapp, whatsappGuestResponseToOrganizer,
        sendWhatsappPdfToGuest } = require('../services/whatsapp.service');
const { isPaymentValidated, incrementSentInvitations } = require('../models/payment');

const addGuest = async (req, res, next) => {
    let connection;
    try {
        //console.log('req.body:', req.body);

        // =========================
        // 1. VALIDATION
        // =========================
        if ( !Array.isArray(req.body) || req.body.length === 0 ) {
            return res.status(400).json({
                error: 'La liste des invités est vide'
            });
        }
        const guestDatas = req.body;
        const eventId = guestDatas[0].eventId;
        //console.log('###eventId:', eventId);

        if (!eventId) {
            return res.status(400).json({
                error: 'eventId requis'
            });
        }

        // =========================
        // 2. EVENT
        // =========================
        const event = await getEventById(eventId);
        if (!event) {
            return res.status(404).json({
                error: `Evénement ${eventId} introuvable`
            });
        }

        // =========================
        // 3. USER 
        // =========================

        const user = await getUserByEvtId(eventId);
        if (!user) {
            return res.status(404).json({
                error: 'Organisateur introuvable'
            });
        }

        // =========================
        // 4. LIMIT CHECK
        // =========================
        const existingGuestsCount = Number(user.total_guests || 0);
        const totalAfterAdd = existingGuestsCount + guestDatas.length;
        if (totalAfterAdd > Number(event.max_guests)) {
            return res.status(403).json({
                error: `Le quota de ${event.max_guests} invités pour cet événement serait dépassé.`
            });
        }

        // =========================
        // 5. BEGIN TRANSACTION
        // =========================
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const createdGuests = [];

        // =========================
        // 6. VALIDATIONS
        // =========================
        for (const guest of guestDatas) {
            const {
                fullName,
                email,
                phoneNumber,
                rsvpStatus,
                guesthasPlusOneAutoriseByAdmin,
                notificationMode
            } = guest;
            const isEmailModeInvalid = notificationMode === 'email' && (!fullName || !email);
            const isWhatsappModeInvalid = notificationMode === 'whatsapp' && (!fullName || !phoneNumber);
            if (isEmailModeInvalid) {
                throw new Error('Nom et email obligatoires');
            }
            if (isWhatsappModeInvalid) {
                throw new Error('Nom et Numéro Whatsapp obligatoires');
            }

            // Vérification doublon
            if(email){
                const existingGuest = await getGuestEmailRelatedToEvent(email, eventId);
                if ( existingGuest ) { //existingGuest.email !== user.email
                    throw new Error( `L'invité ${email} existe déjà` );
                }
            }
            if(phoneNumber){
                const phone = await removeCountryCode(phoneNumber);
                const existingGuest = await getGuestPhoneRelatedToEvent(phone, eventId);
                if ( existingGuest ) { //existingGuest.email !== user.email
                    throw new Error( `L'invité ${phoneNumber} existe déjà` );
                }
            }

            // =========================
            // 7. CREATE GUEST
            // =========================
            const guestId = await createGuest(
                connection,
                eventId,
                fullName,
                email,
                phoneNumber,
                rsvpStatus,
                guesthasPlusOneAutoriseByAdmin,
                notificationMode
            );
            createdGuests.push({
                id: guestId,
                eventId,
                fullName,
                email,
                phoneNumber,
                rsvpStatus,
                guesthasPlusOneAutoriseByAdmin,
                notificationMode
            });
        }

        // =========================
        // 8. COMMIT
        // =========================
        await connection.commit();

        // =========================
        // 9. NOTIFICATIONS (OPTIONNEL)
        // =========================
        try {
            await createNotification(
                eventId,
                'Invités ajoutés',
                `${createdGuests.length} invités ajoutés`,
                'info',
                false
            );
        } catch (notifError) {
            console.error('#1#NOTIFICATION ERROR:',notifError.message);
        }

        // =========================
        // 10. RESPONSE
        // =========================
        return res.status(201).json({success: true,guests: createdGuests});

    } catch (error) {
        console.error('CREATE GUEST ERROR:',error.message);

        // =========================
        // ROLLBACK
        // =========================
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'ROLLBACK ERROR:',
                    rollbackError.message
                );
            }
        }
        return res.status(500).json({
            error: error.message
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const addGuestFromLink = async (req, res, next) => {

    try {
        //console.log('guestData :: ', req.body);
        const {
            eventId,fullName,email,phoneNumber,rsvpStatus,guestHasPlusOneAutoriseByAdmin,
            dietaryRestrictions,plusOneNameDietRestr,hasPlusOne,plusOneName,token, notificationMode
        } = req.body;

        /*
        =========================================
        1. VALIDATION
        =========================================
        */
        const isEmailModeInvalid = notificationMode === 'email' && (!eventId || !fullName || !email || !token);
        const isWhatsappModeInvalid = notificationMode === 'whatsapp' && (!eventId || !fullName || !phoneNumber || !token);
        if (isEmailModeInvalid) {
            return res.status(400).json({error: 'Nom et Email obligatoires.'});
        }
        if (isWhatsappModeInvalid) {
            return res.status(400).json({error: 'Nom et Numéro obligatoires.'});
        }

        /*
        =========================================
        1-bis. VERIFICATION PAIEMENT VALIDE
        =========================================
        */
        const paid = await isPaymentValidated(eventId);
        if (!paid) {
            return res.status(402).json({
                error: "Le paiement de cet événement n'est pas encore validé. Aucune invitation ne peut être envoyée."
            });
        }

        /*
        =========================================
        2. VERIFICATION QUOTA
        =========================================
        */
        const user = await getUserByEvtId(eventId);
        if (!user) {
            return res.status(404).json({
                error: 'Utilisateur introuvable.'
            });
        }

        const eventData = await getEventById(eventId);
        const guestCount = Number(user.total_guests || 0);
        if (guestCount >= Number(eventData.max_guests)) {
            return res.status(403).json({
                error: "Le quota d'invités pour cet événement est atteint."
            });
        }

        /*
        =========================================
        3. VERIFICATION LIEN
        =========================================
        */
        const link = await getLinkByToken(token);
        ////console.log('###Link found:', link);
        if (!link) {
            return res.status(404).json({
                error: "Lien d'invitation introuvable"
            });
        }

        if (link.date_limit_link && new Date(link.date_limit_link) < new Date()) {
            return res.status(410).json({
                error: "Lien expiré"
            });
        }

        if (Number(link.used_count) >= Number(link.limit_count)) {
            return res.status(401).json({
                error: "Limite d'utilisation du lien atteinte."
            });
        }

        /*
        =========================================
        EVENT
        =========================================
        */
        const event = await getEventById(eventId);
        ////console.log('###Event:', event);
        if (!event) {
            return res.status(404).json({
                error: "Evénement introuvable"
            });
        }

        /*
        =========================================
        EXISTING GUEST
        =========================================
        */
        // Vérification doublon
        if(email){
            const existingGuest = await getGuestEmailRelatedToEvent(email, eventId);
            if ( existingGuest ) {
                return res.status(409).json({error: `L'invité ${email} existe déjà`});
            }
        }
        if(phoneNumber){
            const phone = await removeCountryCode(phoneNumber);
            const existingGuest = await getGuestPhoneRelatedToEvent(phone, eventId);
            if ( existingGuest ) {
                return res.status(409).json({error: `L'invité ${phoneNumber} existe déjà`});
            }
        }

        /*
        =========================================
        5. CREATION GUEST
        =========================================
        */
        const guestId = await createGuestFromLink(
            eventId, fullName, email, phoneNumber, notificationMode, rsvpStatus, guestHasPlusOneAutoriseByAdmin,
            dietaryRestrictions, plusOneNameDietRestr, hasPlusOne, plusOneName
        );

        /*
        =========================================
        6. CREATION INVITATION
        =========================================
        */
        const invitationToken = `${guestId}:${uuidv4()}`;
        const invitationId = await createInvitation( guestId, invitationToken, null );

        if (!invitationId) {
            throw new Error(
                "Erreur lors de la création de l'invitation"
            );
        }

        /*
        =========================================
        7. UPDATE USED_COUNT
        =========================================
        */
        const updated = await updateLinkUsedCount(link.id, 'increment');

        if (!updated) {
            throw new Error(
                "Impossible de mettre à jour le lien"
            );
        }

        /*
        =========================================
        9. GENERATION QR/PDF
        =========================================
        */
        const guest = await getGuestAndInvitationRelatedById(guestId);
        const guestEventRelated = await getGuestAndEventRelatedById(guestId);
        const card = await getEventInvitNote(eventId);

        let qrUrl = '';
        let pdfBuffer = null;

        try {
            qrUrl = await generateGuestQr( guestId, invitationToken, "wedding-ring.webp" );
            if (!card.has_invitation_model_card) {
                pdfBuffer = await generateGuestPdf( guestEventRelated[0], card, plusOneName );
            }
        } catch (error) {
            console.error('QR/PDF ERROR:', error.message);
        }

        /*
        =========================================
        UPDATE INVITATION WHIT QR URL
        =========================================
        */
        if (qrUrl) {
            await updateInvitationQrCode( guestId, qrUrl );
        }

        /*
        =========================================
        10. UPLOAD FIREBASE
        =========================================
        */
        try {
            if (pdfBuffer) {
                await uploadPdfToFirebase({ id: guestId }, pdfBuffer);
            }
        } catch (error) {
            console.error(
                'Firebase upload ERROR:',
                error.message
            );
        }

        /*
        =========================================
        11. WHATSAPP
        =========================================
        */
       //console.log("notificationMode:", notificationMode);
        if(notificationMode==='whatsapp'){
            try {
                await whatsappInvitationToGuest( guest, qrUrl, pdfBuffer );
                const organizer = await getUserById(event.organizer_id);
                if(organizer.notification_mode === 'email') {
                    await sendGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                }
                if(organizer.notification_mode === 'whatsapp') {
                    await whatsappGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                }
                // Incrément APRÈS envoi WhatsApp confirmé
                await incrementSentInvitations(eventId);
            } catch (error) {
                console.error( 'WHATSAPP ERROR:', error.message );
                try {
                    await deleteGuestAfterError(guestId);
                    await updateLinkUsedCount(link.id, 'decrement');
                    //console.log(`DELETE: Guest ${guestId} supprimé après erreur WhatsApp`);
                } catch (rollbackError) {
                    console.error(
                        'ROLLBACK ERROR:',
                        rollbackError.message
                    );
                }
                throw new Error(error.message);
            }
        }

        /*
        =========================================
        12. EMAIL
        =========================================
        */
       if(notificationMode==='email'){
            try {
                await sendInvitationToGuest( guest, qrUrl, pdfBuffer );
                const organizer = await getUserById(event.organizer_id);
                if(organizer.notification_mode === 'email') {
                    await sendGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                }
                if(organizer.notification_mode === 'whatsapp') {
                    await whatsappGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                }
                // Incrément APRÈS envoi WhatsApp confirmé
                await incrementSentInvitations(eventId);
            } catch (error) {
                console.error('EMAIL ERROR:',error.message);
                try {
                    await deleteGuestAfterError(guestId);
                    await updateLinkUsedCount(link.id, 'decrement');
                    ////console.log(`DELETE: Guest ${guestId} supprimé après erreur Email`);
                } catch (rollbackError) {
                    console.error(
                        'ROLLBACK ERROR:',
                        rollbackError.message
                    );
                }
                throw new Error(error.message);
            }
       }


        /*
        =========================================
        13. NOTIFICATIONS
        =========================================
        */
        try {
            await createNotification(
                event.id,
                `Invitation envoyée`,
                `L'invitation QR Code a été envoyée à ${fullName}.`,
                'info',
                false
            );

            const organizer = await getUserById( event.organizer_id);
            if(organizer.notification_mode === 'email') await sendGuestResponseToOrganizer( organizer, guestEventRelated[0], rsvpStatus );
            if(organizer.notification_mode === 'whatsapp') await whatsappGuestResponseToOrganizer( organizer, guestEventRelated[0], rsvpStatus );
            if (hasPlusOne) {
                await createNotification(
                    event.id,
                    `Réponse invité`,
                    `${fullName} viendra accompagné de ${plusOneName}.`,
                    'info',
                    false
                );

            } else {
                await createNotification(
                    event.id,
                    `Réponse invité`,
                    `${fullName} a confirmé sa présence.`,
                    'info',
                    false
                );
            }
        } catch (error) {
            console.error('#2#NOTIFICATION ERROR:',error.message);
        }

        /*
        =========================================
        SUCCESS
        =========================================
        */
        return res.status(201).json({
            success: "Invité ajouté avec succès"
        });

    } catch (error) {

        console.error('AddGuestFromLink ERROR:',error.message);

        return next(error);
    }
};

const removeCountryCode = (phone) => {
  const countryCodes = [
    "+237", "237",
    "+225", "225",
    "+230", "230"
  ];

  for (const code of countryCodes) {
    if (phone.startsWith(code)) {
      return phone.replace(code, "");
    }
  }

  return phone;
};

// Cette méthode a été implémenter pour envoyer le pdf aux invités qui
// avaient confirmés leur présence avant la maj sendInvitationToGuest()
const getAllConfirmedGuest = async (req, res, next) => {
    try {
        const guestIds = await getAllConfirmedGuests();
        let guests = [];
        let buffer;
        for (const g of guestIds) {
            const guest = await getGuestAndInvitationRelatedById(g.id);
            //console.log("guest: ", guest);
            const card = await getEventInvitNote(guest.eventId)
            //console.log("card: ", card);
            buffer = await generateGuestPdf(guest, card);//generateCustomGuestPdf
            const data = {
                guest: guest,
                buffer: buffer
            }
            guests.push(data);
        }        
        // Envoi des mails en parallèle contrôlée (plus rapide)
        await Promise.all(
            guests.map(data => {
                if(data.guest.notification_mode === 'email') return sendPdfToGuestMail(data);
                if(data.guest.notification_mode === 'whatsapp') return sendWhatsappPdfToGuest(data);
                return Promise.resolve();
            })
        );
    } catch (error) {
        console.error('getAllConfirmedGuest ERROR:', error.message);
        next(error);
    }
}

const getAllGuest = async (req, res, next) => {
    try {
        const guests = await getAllGuestAndInvitationRelated();
        if(!guests[0]) return res.status(401).json({error: "Aucun invité trouvé!"});
        return res.status(200).json({guests}); 
    } catch (error) {
        console.error('GET GUEST ERROR:', error.message);
        next(error);
    }
};

const getGuest = async (req, res, next) => {
    try {
        const guest = await getGuestAndInvitationRelatedById(req.params.guestId);
        if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
        return res.status(200).json(guest); 
    } catch (error) {
        console.error('GET GUEST ERROR:', error.message);
        next(error);
    }
};

const getEventByGuest = async (req, res, next) => {
    try {
        const result = await getEventByGuestId(req.params.guestId);
        if(!result) return res.status(404).json({error: "Invité non trouvé!"});
        return res.status(200).json(result[0]);
    } catch (error) {
        next(error);
    }
}

const getGuestsByEvent = async (req, res, next) => {
    try {
        const guests = await getAllGuestAndInvitationRelatedByEventId(req.params.eventId);
        if(guests.length == 0) return res.status(401).json({error: "Aucun invité n'est lié a cette événement! "});
        return res.status(200).json({guests});
    }catch (error) {
        console.error('GET EVENT GUEST ERROR:', error.message);
        next(error);
    }
};

const getUserByEvent = async (req, res, next) => {
    try {
        const info = await getUserByEvtId(req.params.eventId);
        return res.status(200).json(info);
    } catch (error) {
        console.error('getUserByEvent ERROR:', error.message);
        next(error);
    }
}

const updateGuest = async (req, res, next) => {
    try {
        let updatedGuest = {};
        let isValid = false;
        let {
            eventId, fullName, tableNumber, email, phoneNumber, notificationMode, rsvpStatus,
            hasPlusOne, guesthasPlusOneAutoriseByAdmin, plusOneName, 
            notes, dietaryRestrictions, plusOneNameDietRestr, rsvpToken, fromEditePage
        } = req.body;
        //console.log('fromEditePage:', fromEditePage);
        //console.log('req.body:', req.body);
        let updateDate = null;
        const guest = await getGuestById(req.params.guestId);
        //console.log('guestInBd:', guest);
        if(!fromEditePage){
            if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
            if(eventId==null) eventId = guest.event_id;
            if(fullName==null) fullName = guest.full_name;
            if(email==null) email = guest.email;
            if(tableNumber==null) tableNumber = guest.table_number;
            if(phoneNumber==null) phoneNumber = guest.phone_number;
            if(notificationMode==null) notificationMode = guest.notification_mode;
            if(rsvpStatus==null){
                rsvpStatus = guest.rsvp_status;
            }else if(rsvpStatus!=null && rsvpStatus=='confirmed' && hasPlusOne==false){
                //console.log('Mise à jour pour invité sans plus-one');
                // Si le RSVP est confirmé et qu'il n'y a personne qui l'accompagne
                // Envoyer l'invitation Qr-Code déjà généré par mail
                updateDate = new Date();
                const invitation = await getGuestInvitationById(req.params.guestId);
                //console.log('invitation:', invitation[0]);
                if(!invitation[0]) return res.status(404).json({error: "Invitation lié a cet invité introuvale!"});
                if(rsvpToken!= invitation[0].token) return res.status(404).json({error: "Token d'invitation invalide!"});
                try {
                    const event = await getEventByGuestId(guest.id);
                    //console.log('###event :', event);
                    const invite = await getGuestAndInvitationRelatedById(req.params.guestId);
                    const card = await getEventInvitNote(event[0].eventId);
                    //console.log('###card :', card);
                    let buffer = null;
                    if(!card.has_invitation_model_card){
                        buffer = await generateGuestPdf(invite, card);
                        if(guest.notification_mode === 'email') {
                            await sendInvitationToGuest(invite, invitation[0].qr_code_url, buffer);
                        }
                        if(guest.notification_mode === 'whatsapp') {
                            await whatsappInvitationToGuest(guest, invitation[0].qr_code_url, buffer);
                        }
                    }else{
                        if(guest.notification_mode === 'email') {
                            await sendInvitationToGuest(guest, invitation[0].qr_code_url, null);
                        }
                        if(guest.notification_mode === 'whatsapp') {
                            await whatsappInvitationToGuest(guest, invitation[0].qr_code_url, buffer);
                        }
                    }
                    const organizer = await getUserById(event[0].organizerId);
                    //console.log('###organizer: ', organizer);
                    if(organizer.notification_mode === 'email') {
                        await sendGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                    }
                    if(organizer.notification_mode === 'whatsapp') {
                        await whatsappGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                    }
                    await createNotification(
                        event[0].eventId,
                        `Reponse Invité.`,
                        `L'invité ${guest.full_name} vient d’accepter votre invitation.`,
                        'info',
                        false
                    );
                    isValid = true;
                } catch (error) {
                    console.error('send email ERROR:', error.message);
                    next(error);
                }
            }else if(rsvpStatus=='declined'){
                ////console.log('RSVP décliné, pas d\'envoi d\'invitation');
                // Si le RSVP est décliné, ne pas envoyer l'invitation
                const invitation = await getGuestInvitationById(req.params.guestId);
                if(!invitation[0]) return res.status(404).json({error: "Invitation lié a cet invité introuvale!"});
                if(rsvpToken!= invitation[0].token) return res.status(404).json({error: "Token d'invitation invalide!"});
                updateDate = new Date();
                isValid = true;
                const event = await getEventByGuestId(guest.id);
                const organizer = await getUserById(event[0].organizerId);
                if(organizer.notification_mode === 'email') {
                    await sendGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                }
                if(organizer.notification_mode === 'whatsapp') {
                    await whatsappGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                }
                await createNotification(
                    event[0].eventId,
                    `❌ Reponse Invité.`,
                    `L'invité ${guest.full_name} a décliné votre invitation.`,
                    'info',
                    false
                );
            }
            if(guesthasPlusOneAutoriseByAdmin==null) {guesthasPlusOneAutoriseByAdmin = guest.guest_has_plus_one_autorise_by_admin;}
            if(hasPlusOne==null || hasPlusOne==undefined) hasPlusOne = guest.has_plus_one;
            if(plusOneName==null) plusOneName = guest.plus_one_name;
            if(updateDate==null) updateDate = guest.updated_at;
            if(notes==null) notes = guest.notes;
            if(dietaryRestrictions==null) dietaryRestrictions = guest.dietary_restrictions;
            if(plusOneNameDietRestr==null) plusOneNameDietRestr = guest.plus_one_name_diet_restr;
            if (rsvpStatus=='confirmed' && hasPlusOne==true && guest.has_plus_one==false) {
                //console.log('Mise à jour pour invité avec plus-one');
                // Si le champ hasPlusOne est passé à true
                // Supprimer l'ancienne invitation et les fichiers associés(QR code et PDF)
                // Envoyer une nouvelle invitation en tenant compte de la personne qui l'accompagne
                try {
                    const guest = await getGuestAndInvitationRelatedById(req.params.guestId);
                    //console.log('[guest] guest: ', guest);
                    if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
                    if(rsvpToken!= guest.invitationToken) return res.status(404).json({error: "Token d'invitation invalide!"});
                    await deleteGuestFiles(guest.guest_id, guest.invitationToken);
                    await generateGuestQr(guest.guest_id, guest.invitationToken, "wedding-ring.webp");
                    //console.log('[plusOneName] plusOneName: ', plusOneName);
                    const event = await getEventByGuestId(guest.guest_id);
                    //console.log('###event :', event);
                    const card = await getEventInvitNote(event[0].eventId);
                    let buffer = null;
                    if(!card.has_invitation_model_card){
                        buffer = await generateGuestPdf(guest, card);
                        await uploadPdfToFirebase(guest, buffer);
                        if(guest.notification_mode === 'email') {
                            await sendInvitationToGuest(guest, guest.qrCodeUrl, buffer);
                        }
                        if(guest.notification_mode === 'whatsapp') {
                            await whatsappInvitationToGuest(guest, guest.qrCodeUrl, buffer);
                        }
                    }else{
                        if(guest.notification_mode === 'whatsapp') {
                            await whatsappInvitationToGuest(guest, guest.qrCodeUrl, buffer);
                        }
                        if(guest.notification_mode === 'email') {
                            await sendInvitationToGuest(guest, guest.qrCodeUrl, null);
                        }
                    }
                    isValid = true;
                    ////console.log('###event[0].organizerId :', event[0].organizerId);
                    const organizer = await getUserById(event[0].organizerId);
                    if(organizer.notification_mode === 'email') {
                        await sendGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                    }
                    if(organizer.notification_mode === 'whatsapp') {
                        await whatsappGuestResponseToOrganizer(organizer, guest, rsvpStatus);
                    }
                    await createNotification(
                        event[0].eventId,
                        `Reponse Invité.`,
                        `L'invité ${guest.full_name} vient d’accepter votre invitation et viendra accompagné de ${plusOneName}.`,
                        'info',
                        false
                    );
                } catch (error) {
                    console.error('sendInvitationToGuest ERROR:', error.message);
                    next(error);
                }
            }
            if(isValid){
                await update_guest(req.params.guestId, eventId, fullName, tableNumber, email, phoneNumber, notificationMode, rsvpStatus, hasPlusOne,
                guesthasPlusOneAutoriseByAdmin, plusOneName, notes, dietaryRestrictions, plusOneNameDietRestr, updateDate);
                updatedGuest = await getGuestById(req.params.guestId);
            }else{
                const guest = await getGuestAndInvitationRelatedById(req.params.guestId);
                if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
                if(rsvpToken!= guest.invitationToken) return res.status(404).json({error: "Token d'invitation invalide!"});
                //console.log('Aucune mise à jour effectuée car les conditions ne sont pas remplies.');
            }
        }else{
            updateDate = new Date();
            await update_guest(req.params.guestId, eventId, fullName, tableNumber, email, phoneNumber, notificationMode, rsvpStatus, guest.has_plus_one,
            guesthasPlusOneAutoriseByAdmin, plusOneName, notes, dietaryRestrictions, plusOneNameDietRestr, updateDate);
            updatedGuest = await getGuestById(req.params.guestId);
        }
        
        ////console.log('updatedGuest:', updatedGuest);
        return res.status(200).json({updatedGuest});
    } catch (error) {
        console.error('UPDATE GUEST ERROR:', error.message);
        next(error);
    }
}

const updateRsvpStatus = async (req, res, next) => {
    try {
        const {rsvpStatus} = req.body;
        const guest = await getGuestById(req.params.guestId);
        if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
        await updateRsvpStatusGuest(req.params.guestId, rsvpStatus);
        const response = await getGuestById(req.params.guestId);
        return res.status(200).json(response);
    } catch (error) {
        console.error('UPDATE RSVP GUEST ERROR:', error.message);
        next(error)
    }
};

const deleteGuest = async (req, res, next) => {
    try {
        const guest = await getGuestAndInvitationRelatedById(req.params.guestId);
        ////console.log('guest:', guest);
        if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
        await delete_guest(req.params.guestId);
        await deleteGuestFiles(guest.guest_id, guest.invitationToken);
        return res.status(200).json({message: `Invité ${req.params.guestId} supprimé avec succès!`});
    } catch (error) {
        console.error('DELETE GUEST ERROR:', error.message);
        next(error);
    }
};

const deleteSeveralGuests = async (req, res, next) => {
    try {
        if (req.body.length==0) return res.status(404).json({error: "Liste vide"});
        let guestIdList = req.body;
        ////console.log('guestIdList:', guestIdList);
        let returnDatas = [];
        for (const key in guestIdList) {
            const id = guestIdList[key];
            const guest = await getGuestAndInvitationRelatedById(id);
            if(!guest) return res.status(401).json({error: "Aucun invité trouvé!"});
            await delete_guest(id);
            if(guest.invitationId) {
                await deleteGuestFiles(guest.guest_id, guest.invitationToken);
            }
            returnDatas.push(id);
        }
        return res.status(200).json({message: `Les Invités ${returnDatas} ont été supprimé avec succès!`});
    } catch (error) {
        console.error('DELETE GUEST ERROR:', error.message);
        next(error);
    }
}

const sendReminder = async (req, res, next) => {
    try {
        if (req.body.length==0) return res.status(404).json({error: "Liste vide"});
        let guests = req.body;
        for (const key in guests) {
            const guestId = guests[key];
            const event = await getGuestAndInvitationRelatedById(guestId);
            const guest = event;
            if(guest.notification_mode === 'email') await sendReminderMail(guest, event);
            if(guest.notification_mode === 'whatsapp') await sendReminderWhatsapp(guest, event);
        }
        return res.status(200).json({success: "Email de rappel envoyé avec success!"})
    } catch (error) {
        next(error)
    }
}

const sendFileQRCode = async (req, res, next) => {
    try {
        const event = await getGuestAndInvitationRelatedById(req.params.guestId);
        const guest = event;
        if(guest.notification_mode === 'email') await sendFileQRCodeMail(guest, guest.qrCodeUrl);
        if(guest.notification_mode === 'whatsapp') await sendFileQRCodeWhatsapp(guest, guest.qrCodeUrl);
        return res.status(200).json({success: "Fichier Qr-Code envoyé avec success!"})
    } catch (error) {
        next(error)
    }
}

async function deleteGuestAfterError(guestId) {
  try {
    const guest = await getGuestAndInvitationRelatedById(guestId);
    if (!guest) {
      console.warn(`[deleteGuestAfterError] Guest ${guestId} déjà absent, rien à supprimer.`);
      return;  // ← Simplement retourner, pas de res.status()
    }
    await delete_guest(guestId);
    if (guest.invitationToken) {
      await deleteGuestFiles(guest.guest_id, guest.invitationToken);
    }
  } catch (error) {
    console.error('[deleteGuestAfterError] Erreur cleanup:', error.message);
  }
}

module.exports = {addGuest, getGuest, getGuestsByEvent, 
                  updateGuest, getEventByGuest, 
                  updateRsvpStatus, deleteGuest, 
                  deleteSeveralGuests, getAllGuest, 
                  sendReminder, sendFileQRCode, 
                  addGuestFromLink, getAllConfirmedGuest,
                  getUserByEvent
                };