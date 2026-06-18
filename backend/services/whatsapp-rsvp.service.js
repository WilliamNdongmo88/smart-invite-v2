const { processGuestInvitationResponse } = require("./guest-response.service");
const { getGuestById, updateRsvpStatusGuest } = require("../models/guests");
const { getInvitationByChatId, updateInvitationByChatId, getInvitationById } = require("../models/invitations");
const { findTrackingByMessageId } = require( '../models/whatsapp-tracking' );

const handleRsvp = async (client, message) => {

    try {
        /**
         * Ignorer messages du bot
         */
        if (message.fromMe) {
            return;
        }

        /**
         * Texte utilisateur
         */
        const text = message.body.trim().toLowerCase();

        /**
         * Numéro WhatsApp
         */
        const phone = message.from;
        const chatId = message.from;

        //console.log('ChatId:', chatId);
        //console.log( `📩 Message reçu : ${text}` );

        /**
         * Retrouver le tracking et l'invitation
         */
            const isUserExist = await getInvitationByChatId( message.from );
            if (!isUserExist) {
                    //console.log('Numéro non enregistré :',message.from);
                return;
            }

        //console.log('message.hasQuotedMsg: ', message.hasQuotedMsg);
        if (!message.hasQuotedMsg) {
            await message.reply(
                `Merci de faire un appui long sur le message, 
                cliquer sur Répondre puis saisissez votre réponse`
            );
            return;
        }

        const quoted = await message.getQuotedMessage();
        //console.log('###quoted: ', quoted);
        const tracking = await findTrackingByMessageId( quoted.id._serialized );
        //console.log('tracking trouvée :', tracking);
        
        if (!tracking) {
            //await message.reply( `❌ Aucune invitation trouvée.` );
            return;
        }
        
        const invitation = await getInvitationById( tracking.invitation_id );
        const guest = await getGuestById( tracking.guest_id );
        const eventId = tracking.event_id;
        //console.log('Invitation trouvée :', invitation);

        /**
         * Détection RSVP
         */
        let response = null;

        /**
         * Regex
         */
        const yesRegex =/\b(oui|ok|présent|present)\b/i;

        const noRegex =/\b(non|absent|désolé|desole)\b/i;

        const maybeRegex =/\b(peut-être|peut etre|possible)\b/i;

        /**
         * RSVP OUI
         */
        if (yesRegex.test(text)) {
            response = 'confirmed';
        }

        /**
         * RSVP NON
         */
        else if ( noRegex.test(text)) {
            response = 'declined';
        }

        /**
         * RSVP MAYBE
         */
        else if (maybeRegex.test(text)) {
            response = 'maybe';
        }

        /**
         * Réponse inconnue
         */
        if (!response) {
            await message.reply(
                `😊 Merci pour votre message.\n\nVeuillez répondre uniquement avec :\n\n✅ OUI\n❌ NON\n❓ PEUT-ÊTRE`
            );
            return;
        }

        //console.log( `✅ RSVP : ${response}` );

        /**
         * Réponse automatique
         */
        switch (response) {
            case 'confirmed':
                await message.reply(
                    `🎉 Merci pour votre confirmation❤️
                    \n Veuillez consulter les informations ci-dessous
                    \n 👇👇👇👇👇👇👇👇👇👇`
                );
                if(!invitation[0].is_invitation_sent){
                    const guest = await getGuestById(invitation[0].guest_id);
                    await processGuestInvitationResponse(guest, invitation[0], 'confirmed');
                    await updateInvitationByChatId(invitation[0].id, chatId, true);
                    await updateRsvpStatusGuest(guest.id, 'confirmed');
                }else{
                    await message.reply(`✅ Votre invitation a déjà été envoyée.`);
                }
                break;

            case 'declined':
                await message.reply(
                    `🙏 Merci pour votre réponse.\n\nNous espérons vous voir une prochaine fois ❤️`
                );

                break;

            case 'maybe':
                await message.reply(
                    `😊 Merci !\n\nNous restons en attente de votre confirmation finale ❤️`
                );

                break;
        }

    } catch (error) {
        console.error( '❌ Erreur RSVP :', error );
    }
};

module.exports = { handleRsvp }