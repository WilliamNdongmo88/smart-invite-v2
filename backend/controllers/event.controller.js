const admin = require('../config/firebaseConfig');
const { bucket} = require('../config/firebaseConfig');
const {getUserById} = require('../models/users');
const {createEvent, getEventById,updateEvent,updateEventStatus,
    getEventsByOrganizerId, getEventWithTotalGuest, deleteEvents, 
    getEventWithTotalGuestById, getEventAndInvitationById,
    getUserByEventId} = require('../models/events');
const {getGuestByEventIdAndConfirmedRsvp} = require('../models/guests');
const {getGuestsCheckIns} = require('../models/checkins');
const { generatePresentGuestsPdf, generateDualGuestListPdf, uploadPdfToFirebase } = require('../services/pdfService');

const schedule = require('node-schedule');
const { getGuestByInvitationId } = require('../models/invitations');
const { sendPdfByEmail } = require('../services/notification.service');
const { sendPdfByWhatsapp } = require('../services/whatsapp.service');
const { sendScheduledThankMessage } = require('./checkin.controller');
const { getEventScheduleByEventId, createEventSchedule, updateEventSchedule, deleteEventSchedule } = require('../models/event_schedules');
const { creatEventInvitNote, getEventInvitNote, updateEventInvitNote } = require("../models/event_invitation_notes");
const { deleteInvitationFiles } = require("../services/invitation.service");
const {
  getPaymentByEventId, resetPaymentForNewQuota, getValidatedQuota, 
  createEventPayment, getAllPayments, updateEventPaymentsByEventId
} = require('../models/payment');

const create_Event = async (req, res, next) => {
  try {
    const eventDatas = await createEventService(req.body);
    return res.status(201).json({ eventDatas });
  } catch (error) {
    next(error);
  }
};

const createEventWithFile = async (req, res, next) => {
    try {
        const invitationFile = req.file;
        const eventDatas = JSON.parse(req.body.eventDatas);
        const user = await getUserById(eventDatas[0].organizerId);
        //console.log('### eventDatas:', eventDatas);
        const datas = {
            eventDatas: eventDatas,
            eventInvitationNote: null
        }
        if (!invitationFile) {
            return res.status(400).json({ message: 'Erreur : Aucun fichier reçu.' });
        }

        const event = await createEventService(datas);
        // //console.log('### event created:', event);

        // Appelez la fonction pour uploader le fichier et attendez le résultat
        const data = await uploadPdfToFirebase(null, invitationFile.buffer, event[0]);
        // //console.log('Fichier uploadé avec succès sur Firebase. URL publique :', publicUrl);
        const pdfUrl = data.url;
        await creatEventInvitNote(event[0].id, null, null, null, null, null, null, 
                null, null, null, null, 
                null, null, null, pdfUrl, true, data.code, null, null);

        res.status(200).json({
            message: 'Fichier uploadé avec succès sur Firebase !',
            fileUrl: pdfUrl // Renvoyez l'URL publique au client
        });
    } catch (error) {
        console.error('CREATE EVENT WITH FILE ERROR:', error.message);
        next(error);
    }
};

const createEventService = async (datas) => {
    try {
        // //console.log('datas :: ', typeof datas, ' :: ', datas);
        if (datas.length==0) throw new Error("Liste vide");
        let eventDatas = datas.eventDatas;
        let eventInvitationNote = datas.eventInvitationNote;
        //console.log('eventDatas :: ', eventDatas);
        
        const existing = await getUserById(eventDatas[0].organizerId);
        if (!existing) throw new Error("Organizer not found with ID: " + eventDatas[0].organizerId);
        let returnDatas = [];
        for (const event of eventDatas) {
            //console.log('Creating event for organizerId:', event.organizerId);
            const {
                organizerId, title, description, eventDate, banquetTime, religiousLocation, 
                religiousTime, type, budget, eventNameConcerned1, eventNameConcerned2, 
                eventCivilLocation, eventLocation, maxGuests,hasPlusOne, footRestriction, 
                showWeddingReligiousLocation, status} = event;
            const eventId = await createEvent(organizerId, title, description, eventDate, banquetTime, 
                                              religiousLocation, religiousTime, type, budget, 
                                              eventNameConcerned1,eventNameConcerned2, 
                                              eventCivilLocation, eventLocation, maxGuests,hasPlusOne, 
                                              footRestriction, showWeddingReligiousLocation, status);
            //console.log('[create_Event] New event created with ID:', eventId);
            returnDatas.push({id: eventId, organizerId, title, description, eventDate, banquetTime, 
                religiousLocation, religiousTime, type, budget, eventNameConcerned1,eventNameConcerned2, 
                eventCivilLocation, eventLocation, maxGuests,hasPlusOne, footRestriction, 
                showWeddingReligiousLocation, status});
            
            if(eventInvitationNote != null || eventInvitationNote != undefined){
                const {invTitle, mainMessage, sousMainMessage, eventTheme, priorityColors, qrInstructions, 
                       dressCodeMessage, thanksMessage1, closingMessage, titleColor, 
                       topBandColor, bottomBandColor, textColor, logoUrl, heartIconUrl
                } = eventInvitationNote;
                await creatEventInvitNote(eventId, invTitle, mainMessage, sousMainMessage, eventTheme, priorityColors, qrInstructions, 
                   dressCodeMessage, thanksMessage1, closingMessage, titleColor, 
                   topBandColor, bottomBandColor, textColor, null, false, logoUrl, heartIconUrl);
            }

            // Planification (Sensé s'exécuter le lendemain du jour de l'événement)
            try {
                //console.log('[create_Event] eventId :', eventId);
                const existingSchedule = await getEventScheduleByEventId(eventId);
                if (existingSchedule) {
                    //console.log(`Schedule déjà existant pour event ${eventId}`);
                    return;
                }
                const scheduleId = await createEventSchedule(eventId, eventDate, false);
                if (process.env.NODE_ENV !== 'test') {
                    await planSchedule(scheduleId, eventId, eventDate);
                }
            } catch (error) {
                console.error("Erreur planification scheduler:", error);
            }
        }
        return returnDatas;
    } catch (error) {
        console.error('CREATE EVENT ERROR:', error.message);
        throw error;
    }
};

const getAllEvents = async (req, res, next) => {
    try {
        const result = await getEventWithTotalGuest();
        if(!result) return res.status(404).json({error: "Aucun Evénement trouvé!"});
        return res.status(200).json({result});
    } catch (error) {
        console.error('GET EVENT BY ID ERROR:', error.message);
        next(error);
    }
}

  const getEventBy_Id = async (req, res, next) => {
    try {
        const event = await getEventWithTotalGuestById(req.params.eventId);
        //console.log('### event:', event);
        if(!event) res.status(404).json({ error: 'Aucun Evénement trouvé' });
        return res.status(200).json(event);
    } catch (error) {
        console.error('GET EVENT BY ID ERROR:', error.message);
        next(error);
    }
  };

  const getEventInvitationNote = async (req, res, next) => {
    try {
        const event = await getEventInvitNote(req.params.eventId);
        //console.log('### event:', event);
        if(!event) res.status(404).json({ error: 'Aucun Evénement trouvé' });
        return res.status(200).json(event);
    } catch (error) {
        console.error('GET EVENT-INVT-NOTE BY EVENT-ID ERROR:', error.message);
        next(error);
    }
  };

  const getEventAndInvitationRelatedById = async (req, res, next) => {
    try {
        const event = await getEventAndInvitationById(req.params.eventId);
        if(!event) res.status(404).json({ error: 'Aucun Evénement trouvé' });
        return res.status(200).json(event);
    } catch (error) {
        console.error('GET EVENT-INVITATION BY ID ERROR:', error.message);
        next(error);
    }
  }

  const getOrganizerEvents = async (req, res, next) => {
    try {
        const organizerEvent = await getEventsByOrganizerId(req.params.organizerId);
        if(organizerEvent.length == 0) return res.status(404).json({ error: 'Aucun Evénement trouvé' });
        //console.log('organizerEvent:', organizerEvent);
        return res.status(200).json({ events: organizerEvent });
    } catch (error) {
        console.error('GET EVENT BY OrganizerID ERROR:', error.message);
        next(error);
    }
  }

  const updateEventBy_Id = async (req, res, next) => {
    try {
        //console.log('req.body: ', req.body);
        const updatedEvent = await updateEventService(req.params.eventId, req.body);
        
        return res.status(200).json({ eventDatas: updatedEvent });
    } catch (error) {
        console.error('UPDATE EVENT BY ID ERROR:', error.message);
        next(error);
    }
  };

  const updateEventWithFile = async (req, res, next) => {
    try {
        //console.log('req.params.eventId:', req.params.eventId);
        const eventId = req.params.eventId;
        const invitationFile = req.file;
        // //console.log('eventDatas:', JSON.parse(req.body.eventDatas));
        // //console.log('eventInvitationNote:', JSON.parse(req.body.eventInvitationNote));
        const eventDatas = JSON.parse(req.body.eventDatas);
        const eventInvitationNote = JSON.parse(req.body.eventInvitationNote);
        console.log("######eventDatas: ", eventDatas);

        if (!invitationFile) {
        return res.status(400).json({ error: 'Aucun fichier reçu' });
        }

        if (!eventDatas) {
        return res.status(400).json({ error: 'eventDatas manquant' });
        }

        const payload = {
            eventDatas: eventDatas,
            eventInvitationNote: null,
        };

        // 1. Mise à jour de l’événement
        const updatedEvent = await updateEventService(
            eventId,
            payload
        );
        //console.log('updatedEvent:', updatedEvent);

        // 2. Suppression ancien PDF
        const eventInvNote = await getEventInvitNote(updatedEvent.id);
        const path = `event_${updatedEvent.id}_default_carte_${eventInvNote.code}.pdf`;
        //console.log('[path]:', path);
        const resDel = await deleteInvitationFiles(path);
        // //console.log('resDel:', resDel);

        // 3. Upload nouveau PDF
        if(!resDel.success) return res.status(500).json({error: "Erreur lors de la suppression du fichier"});
        const data = await uploadPdfToFirebase(
            null,
            invitationFile.buffer,
            updatedEvent
        );
        //console.log('pdfUrl:', data.url);

        const eventInvitNote = {
            eventId: eventId,
            invTitle: null,
            mainMessage: null,
            eventTheme: null,
            priorityColors: null,
            qrInstructions: null,
            dressCodeMessage: null,
            thanksMessage1: null,
            sousMainMessage: null,
            closingMessage: null,
            titleColor: null,
            topBandColor: null,
            bottomBandColor: null,
            textColor: null,
            pdfUrl: data.url,
            hasInvitationModelCard: eventInvitationNote.hasInvitationModelCard,
            code: data.code,
            logoUrl: null,
            heartIconUrl: null
        }
        //console.log('[eventInvitNote]: ', eventInvitNote);
        // 4. Update invitation note (PDF seulement)
        await updateEventInvitationNote(eventInvitNote);

        return res.status(200).json({
            message: 'Événement mis à jour et fichier uploadé avec succès',
            eventDatas: updatedEvent,
            fileUrl: data.url
        });

    } catch (error) {
        console.error('UPDATE EVENT WITH FILE ERROR:', error.message);
        throw error; 
    }
  };

  async function updateEventService(eventId, payload) {
    let { organizerId, title, description, eventDate, banquetTime, religiousLocation, religiousTime, 
            eventCivilLocation, eventLocation, maxGuests, hasPlusOne, footRestriction, 
            showWeddingReligiousLocation, status, type, budget, eventNameConcerned1, eventNameConcerned2
        } = payload.eventDatas;
    
    const event = await getEventById(eventId);
    const payment = await getAllPayments();
    //console.log("payment: ", payment);
    if(maxGuests <= event.max_guests && payment[0].status == 'pending') await updateEventPaymentsByEventId(eventId, maxGuests);

    if (maxGuests < event.max_guests) {
        throw new Error("Le nouveau quota ne peut pas être inférieur au quota actuel.");
    }

    if(!event) throw new Error("Cet Evénement n'existe pas");

    if(organizerId == null){ organizerId = event.organizer_id};
    if(title == null){ title = event.title};
    if(description == null){ description = event.description};
    if(eventDate == null){ eventDate = event.event_date};
    if(banquetTime == null){ banquetTime = event.banquet_time};
    if(religiousLocation == null){ religiousLocation = event.religious_location};
    if(religiousTime == null){ religiousTime = event.religious_time};
    if(eventCivilLocation == null){ eventCivilLocation = event.civil_location};
    if(eventLocation == null){ eventLocation = event.event_location};
    if(maxGuests == null){ maxGuests = event.max_guests};
    if(hasPlusOne == null){ hasPlusOne = event.has_plus_one};
    if(type == null){ type = event.type};
    if(budget == null){ budget = event.budget};
    if(eventNameConcerned1 == null){ eventNameConcerned1 = event.event_name_concerned1};
    if(eventNameConcerned2 == null){ eventNameConcerned2 = event.event_name_concerned2};
    if(footRestriction == null){ footRestriction = event.foot_restriction};
    if(showWeddingReligiousLocation == null){ showWeddingReligiousLocation = event.show_wedding_religious_location};
    if(status == null){ status = event.status};

    const organizer = await getUserById(organizerId);
    if(!organizer) throw new Error("Organizer non trouvé!");
    await updateEvent(eventId, organizerId, title, description, eventDate, banquetTime,
        religiousLocation, religiousTime, eventCivilLocation, eventLocation, maxGuests, hasPlusOne, 
        footRestriction, showWeddingReligiousLocation, status, type, 
        budget, eventNameConcerned1, eventNameConcerned2 );
    const updatedEvent = await getEventById(eventId);
    if(payload.eventInvitationNote != null){
        await updateEventInvitationNote(payload.eventInvitationNote);
    }
    
    const existingSchedule = await getEventScheduleByEventId(eventId);
    //console.log('### existing schedule:', existingSchedule);
    const scheduleId = await updateEventSchedule(existingSchedule.id, eventId, eventDate, false, false);
    //console.log('### scheduleId:', scheduleId);

    //console.log(`Schedule mis à jour pour event ${eventId} → Exécution : ${eventDate}`);
    //console.log("updateEventBy_Id env.NODE_ENV: ", process.env.NODE_ENV);
    const user = await getUserByEventId(eventId);
    if(user.attendance_notifications){
        //console.log("updateEventBy_Id env.NODE_ENV: ", process.env.NODE_ENV);
        if (process.env.NODE_ENV !== 'test') {
            planSchedule(scheduleId, eventId, eventDate);
        }
    }

    return updatedEvent;
  }

  async function updateEventInvitationNote(eventInvitationNote) {
    //console.log('[updateEventInvitationNote] eventInvitationNote: ', eventInvitationNote);
    try {
        let {eventId, invTitle, mainMessage, sousMainMessage, eventTheme, priorityColors, 
            qrInstructions, dressCodeMessage, thanksMessage1, closingMessage, titleColor, 
            topBandColor, bottomBandColor, textColor, pdfUrl, hasInvitationModelCard, code, logoUrl, heartIconUrl
        } = eventInvitationNote;

        const event = await getEventInvitNote(eventId);
        //console.log('event: ', event);
        if(!event) throw new Error("La table de note de cet event n'existe pas");
        
        if(eventId == null){ eventId = event.event_id};
        if(invTitle == null){ invTitle = event.title};
        if(mainMessage == null){ mainMessage = event.main_message};
        if(sousMainMessage == null){ sousMainMessage = event.sous_main_message};
        if(eventTheme == null){ eventTheme = event.event_theme};
        if(priorityColors == null){ priorityColors = event.priority_colors};
        if(qrInstructions == null){ qrInstructions = event.qr_instructions};
        if(dressCodeMessage == null){ dressCodeMessage = event.dress_code_message};
        if(thanksMessage1 == null){ thanksMessage1 = event.thanks_message1};
        if(closingMessage == null){ closingMessage = event.closing_message};
        if(titleColor == null){ titleColor = event.title_color};
        if(topBandColor == null){ topBandColor = event.top_band_color};
        if(bottomBandColor == null){ bottomBandColor = event.bottom_band_color};
        if(textColor == null){ textColor = event.text_color};
        if(pdfUrl == null){ pdfUrl = event.pdf_url};
        if(hasInvitationModelCard == null){ hasInvitationModelCard = event.has_invitation_model_card};
        if(code == null){ code = event.code};
        if(logoUrl == null){ logoUrl = event.logo_url};
        if(heartIconUrl == null){ heartIconUrl = event.heart_icon_url};

        //console.log('pdfUrl: ', pdfUrl);
        await updateEventInvitNote(event.id, eventId, invTitle, mainMessage, sousMainMessage, eventTheme, priorityColors, 
            qrInstructions, dressCodeMessage, thanksMessage1, closingMessage, titleColor, 
            topBandColor, bottomBandColor, textColor, pdfUrl, hasInvitationModelCard, code, logoUrl, heartIconUrl);
    } catch (error) {
        console.error('UPDATE EVENT-INVIT-NOTE BY EVENT-ID ERROR:', error.message);
    }
  }

  const updateEvent_Status = async (req, res, next) => {
    try {
        const {status} = req.body;
        const event = await getEventById(req.params.eventId);
        if(!event) return res.status(404).json({error: `Aucun Evénement trouvé avec l'id: ${req.params.eventId}`});
        await updateEventStatus(req.params.eventId, status);
        const updatedEvent = await getEventById(req.params.eventId);
        return res.status(200).json({updatedEvent});
    } catch (error) {
        console.error('UPDATE STATUS EVENT ERROR:', error.message);
        next(error);
    }
  };

  const deleteEvent = async (req, res, next) => {
    try {
        const event = await getEventById(req.params.eventId);
        if(!event) return res.status(404).json({error: `Evénement non trouvé!`});
        const guests = await getEventWithTotalGuestById(req.params.eventId);
        //console.log("guests: ", guests[0].total_guests);
        if(guests[0].total_guests > 0) return res.status(409).json({error: `Impossible de supprimer cet événement car des invités y sont associés.`});
        await deleteEventSchedule(req.params.eventId);
        await deleteEvents(req.params.eventId);
        return res.status(200).json({message: `Evénement ${req.params.eventId} supprimé avec succès!`})
    } catch (error) {
        console.error('DELETE EVENT ERROR:', error.message);
        next(error);
    }
  }

  const generatePresentGuests = async (req, res, next) => {
    try {
        const guestsList = req.body.filteredGuests;
        const event = req.body.event;
        // //console.log('guestsList:', guestsList);
        // //console.log('event:', event);
        if (!Array.isArray(guestsList) || guestsList.length === 0) {
            return res.status(400).json({ error: 'Le tableau d\'invités est requis' });
        }
        const pdfBuffer = await generatePresentGuestsPdf(guestsList, event);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=invites-present.pdf");
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[generatePresentGuests] error:', error.message);
        next(error);
    }
  }

  async function sendSReportManually(res, next) {
    try {
        await sendScheduledReport();
        return res.status(200).json({succes: true})
    } catch (error) {
        next(error)
    }
  }

  async function sendSThankMessageManually(req, res, next) {
      try {
          await sendScheduledThankMessage(req.body.event, req.body.organizer, req.body.guest);
          return res.status(200).json({succes: true})
      } catch (error) {
          next(error)
      }
  }

  // Créer la date cible: 6 décembre 2025 à 11:33
  //const date = new Date(2025, 10, 23, 19, 21, 0);"2025-11-22T20:56:00.000Z"
  // Attention : le mois commence à 0 => 11 = décembre

  // Planifier la tâche
  async function planSchedule(scheduleId, eventId, eventDate) {
    try {
        console.log('[schedule 1] eventDate :', eventDate);
        if(eventDate==null || eventDate==undefined) throw new Error("La date est invalide");
        // Conversion finale selon ta logique métier
        const scheduleDate = formatDate(eventDate);
        console.log('[schedule 1] scheduleDate (réelle pour scheduler):', scheduleDate);

        // 🔁 Sécurité : annuler s'il existe déjà
        await cancelSchedule(scheduleId);

        // Planification
        schedule.scheduleJob(String(scheduleId), scheduleDate, async () => {
            console.log('🚀 === Job déclenché ===');
            await runScheduledTask(scheduleId, eventId, eventDate);
        });
        console.log('✅ Schedule planifié pour l\'event ', scheduleId, ' date: ', scheduleDate);
    } catch (error) {
        console.error("❌ Erreur planSchedule:", error);
    }
  }

  async function cancelSchedule(scheduleId) {
    const job = schedule.scheduledJobs[String(scheduleId)];

    if (!job) {
        console.log('[cancelSchedule] Aucun job trouvé pour l\`event ', scheduleId);
        return;
    }

    job.cancel();
    delete schedule.scheduledJobs[String(scheduleId)];

    console.log('🛑 Schedule annulé:', scheduleId);
  }
 
  async function runScheduledTask(scheduleId, eventId, scheduledFor) {
    console.log('🚀 Scheduler exécuté pour event:', eventId);

    // Marquer comme exécuté
    await updateEventSchedule(scheduleId, eventId, scheduledFor, true, false);
    await sendScheduledReport(eventId);

    console.log('✅ Scheduler terminé:', eventId);
  }

  async function sendScheduledReport(eventId) {
        console.log('=== Job déclenché =1=');
    try {
        let guestPresentList = [];
        let guestConfirmedList = [];
        let data = {};
        const checkins = await getGuestsCheckIns();
        //console.log("checkins:: ", checkins);
        for (const event of checkins) {
            if(eventId==event.event_id){
                data = await getUserByEventId(event.event_id);
                break
            }
        }
        //console.log('Event data:', data);
        for (const data of checkins) {
            if(data.event_id==eventId){
                const timer1 = data.checkin_time.toISOString().split('T')[1]
                const guest = await getGuestByInvitationId(data.invitation_id);
                const timer2 = guest.usedAt.toISOString().split('T')[1]
                const obj = {
                    name: guest.name,
                    plusOneName: guest.plusOneName,
                    rsvpStatus: guest.rsvpStatus,
                    dateTime: timer1.split(':')[0]+':'+timer1.split(':')[1].split(':')[0],
                    usedAt: timer2.split(':')[0]+':'+timer2.split(':')[1].split(':')[0],
                }
                guestPresentList.push(obj);
            }
        }
        //console.log("guestPresentList:: ", guestPresentList);
        const results = await getGuestByEventIdAndConfirmedRsvp(data.eventId);
        for (const elt of results) {
            const data = {
                name: elt.name,
                phone: elt.phone,
                notificationMode: elt.notificationMode,
                plusOneName: elt.plusOneName,
                rsvpStatus: elt.rsvpStatus,
                updatedAt: elt.updatedAt.toISOString().split('T')[0],
            }
            guestConfirmedList.push(data);
        }
        //console.log("guestConfirmedList:: ", guestConfirmedList);
        const pdfBuffer = await generateDualGuestListPdf(guestPresentList, guestConfirmedList, data);
        //console.log("pdfBuffer:: ", pdfBuffer);
        //console.log("### data:", data);
        if(data.notification_mode === 'email') await sendPdfByEmail(data, pdfBuffer);
        if(data.notification_mode === 'whatsapp') await sendPdfByWhatsapp(data, pdfBuffer);
    } catch (error) {
        console.error('[sendScheduledReport] error:', error);
    }
  }

  function formatDate(iso) {
    let d = new Date(iso);

    // Ajouter 1 jour en UTC
    d.setDate(d.getDate() + 1);

    // Créer une date UTC propre (pas locale)
    const utcDate = new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds()
    ));

    return utcDate;
  }

module.exports = {
    create_Event,
    createEventWithFile,
    getAllEvents, 
    getEventBy_Id,
    getEventInvitationNote,
    getEventAndInvitationRelatedById,
    getOrganizerEvents,
    updateEventBy_Id,
    updateEventWithFile,
    updateEvent_Status,
    deleteEvent,
    generatePresentGuests,
    sendSReportManually,
    sendSThankMessageManually,
    formatDate,
    planSchedule,
    cancelSchedule,
    runScheduledTask,
    sendScheduledReport,
    updateEventService
}