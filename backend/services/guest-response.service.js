const { sendInvitationToGuest, sendGuestResponseToOrganizer } = require('./notification.service');
const { getEventByGuestId, getGuestAndInvitationRelatedById } = require('../models/guests');
const { getEventInvitNote } = require('../models/event_invitation_notes');

const { getUserById } = require('../models/users');

const { createNotification } = require('../models/notification');

const { generateGuestPdf } = require('./pdfService');

async function processGuestInvitationResponse( guest, invitation, rsvpStatus ) {
   // Import localement pour éviter les dépendances circulaires
   const { whatsappInvitationToGuest, whatsappGuestResponseToOrganizer } = require('./whatsapp.service');
   const updateDate = new Date();
   const event = await getEventByGuestId(guest.id);
   const invite = await getGuestAndInvitationRelatedById(guest.id);
   const card = await getEventInvitNote(event[0].eventId);
   //console.log("Card:", card);

   let buffer = null;
   if (!card.has_invitation_model_card) {
      buffer = await generateGuestPdf(invite, card);
      if (guest.notification_mode === 'email') {
         await sendInvitationToGuest( invite, invitation.qr_code_url, buffer );
      }
      if (guest.notification_mode === 'whatsapp') {
         await whatsappInvitationToGuest( invite, invitation.qr_code_url, buffer );
      }

   } else {
    //console.log('Pas de modèle de carte, envoi PDF par défaut');
      if (guest.notification_mode === 'email') {
         await sendInvitationToGuest( guest, invitation.qr_code_url, null );
      }
      if (guest.notification_mode === 'whatsapp') {
         await whatsappInvitationToGuest( invite, invitation.qr_code_url, null );
      }
   }

   const organizer = await getUserById(event[0].organizerId);
   if(organizer.notification_mode === 'email') {
       await sendGuestResponseToOrganizer( organizer, guest, rsvpStatus );
   }
   if(organizer.notification_mode === 'whatsapp') {
       await whatsappGuestResponseToOrganizer( organizer, guest, rsvpStatus );
   }
   await createNotification(
      event[0].eventId,
      `Reponse Invité.`,
      `L'invité ${guest.full_name} vient d’accepter votre invitation.`,
      'info',
      false
   );

   return { success: true, updateDate };
}

module.exports = {
   processGuestInvitationResponse
};