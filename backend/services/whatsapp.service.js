const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { handleRsvp } = require('./whatsapp-rsvp.service');
const { getGuestInvitationById, updateInvitationByChatId } = require('../models/invitations');
const { getEventInvitNote } = require('../models/event_invitation_notes');
const { getPdfUrlFromFirebase } = require('./qrCodeService');
const { saveWhatsappTracking } = require( '../models/whatsapp-tracking' );

let isReady = false;

const client = new Client({

    authStrategy: new LocalAuth({
        clientId: 'main'
    }),

    webVersionCache: {
        type: 'local'
    },

    puppeteer: {

        headless: process.env.NODE_ENV === 'production' ? true : false,

        executablePath: process.env.NODE_ENV === 'production'
            ? '/usr/bin/chromium'
            : undefined,

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions'
        ]
    }
});

client.on('qr', (qr) => {

    //console.log('Scanner le QR Code :');

    qrcode.generate(qr, {
        small: true
    });
});

client.on('authenticated', () => {
    console.log('WhatsApp authentifié ✅');
});

client.on('ready', () => {

    console.log('WhatsApp connecté ✅');

    isReady = true;
});

client.on('loading_screen', (percent, message) => {
    console.log('⏳ Chargement :', percent, message);
});

client.on('disconnected', async (reason) => {

    console.error('❌ WhatsApp déconnecté :', reason);

    isReady = false;

    //console.log('Tentative de reconnexion...');

    try {
        await client.initialize();
    } catch (error) {

        console.error('Erreur reconnexion :', error);
    }
});

client.on('auth_failure', (msg) => {
    console.error('Erreur authentification ❌');
    //console.log(msg);
    isReady = false;
});

/**
 * RSVP listener
 */
client.on( 'message', (message) => handleRsvp(client, message) );

/**
 * Initialisation
 */
client.initialize();

/**
 * Contenu des fonctions d'envoi WhatsApp
 */
const sendMessage = async (numero, message) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    const chatId = `${numero}@c.us`;

    try {

        await client.sendMessage(chatId, message);

        return true;

    } catch (error) {

        console.error(error);

        throw error;
    }
};

//sendGuestEmail
const sendGuestWhatsapp = async ( guest, event, token ) => {
    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }
    //console.log('Event::event', event);
    try {

        /**
         * Vérification numéro invité !guest.phone || 
         */
        if (!guest.phone_number) {
            throw new Error(
                'Numéro WhatsApp invité introuvable'
            );
        }

        /**
         * Nettoyage numéro
         */
        const numero = guest.phone_number.replace(/\D/g, '');

        /**
         * Vérifier numéro WhatsApp
         */
        const numberId = await client.getNumberId(numero);

        if (!numberId) {
            throw new Error(
                'Numéro WhatsApp invalide'
            );
        }

        const chatId = numberId._serialized;
        //console.log('#chatId:', chatId);

        /**
         * Lien RSVP
         */
        const rsvpLink = `${process.env.API_URL}/invitations/${token}`;

        /**
         * Variables événement
         */
        let article = '';
        let sentence = '';
        let concerned = '';
        let eventType = '';

        switch (event.type) {

            case 'wedding':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = 'au ';

                eventType =
                    `Mariage de ${concerned}`;

                sentence =
                    `Nous avons le plaisir de vous inviter à célébrer notre union`;

                break;

            case 'engagement':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = 'aux ';

                eventType =
                    `Fiançailles de ${concerned}`;

                sentence =
                    `Nous avons le plaisir de vous inviter à célébrer nos fiançailles`;

                break;

            case 'anniversary':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = "à l'";

                eventType =
                    `Anniversaire de mariage de ${concerned}`;

                sentence =
                    `Nous avons le plaisir de vous inviter à célébrer notre anniversaire de mariage`;

                break;

            case 'birthday':

                concerned =
                    event.event_name_concerned1;

                article = "à l'";

                eventType =
                    `Anniversaire de ${concerned}`;

                sentence =
                    `J'ai le plaisir de vous inviter à célébrer mon anniversaire`;

                break;

            default:

                concerned =
                    event.event_name_concerned1;

                article = "à l'";

                eventType = 'événement';

                sentence =
                    `Nous avons le plaisir de vous inviter`;

                break;
        }

        /**
         * Date formatée
         */
        const formattedDate =
            new Date(event.event_date)
                .toLocaleDateString(
                    'fr-FR',
                    {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    }
                );

        /**
         * Message WhatsApp
         */
        const whatsappMessage = `💌 *Vous êtes invité ${article}${eventType}*\n
        Bonjour *${guest.full_name}* 👋

        ${sentence} le *${formattedDate}* ✨

        📍 Votre présence compte énormément pour nous ❤️

                ━━━━━━━━━━━━━━━

        👉 Répondez simplement à ce message avec :

        ✅ *OUI* : si vous serez présent(e)
        ❌ *NON* : si vous ne pourrez pas venir
        ❓ *PEUT-ÊTRE* : si vous n’êtes pas encore sûr(e)

                ━━━━━━━━━━━━━━━

        À très bientôt 💖\n*${concerned}*

                _ smart-invite.com _
        `

        /**
         * Envoi WhatsApp
         */
        //await client.sendMessage( chatId, whatsappMessage );
        const sentMessage = await client.sendMessage( chatId, whatsappMessage );

        //console.log(`✅ Invitation WhatsApp envoyée à ${guest.full_name}`);
        try {
            // MAJ INVITATION AVEC CHAT ID POUR SUIVI RSVP
            const invitation = await getGuestInvitationById(guest.id);
            await saveWhatsappTracking( sentMessage.id._serialized, event.eventId,
                                        guest.id, invitation[0].id, chatId );
            const customChatId = event.eventId+':'+chatId;
            await updateInvitationByChatId(invitation[0].id, chatId, false);
        } catch (error) {
            console.error( '[getGuestInvitationById/updateInvitationByChatId] Error:', error );
            sentQrMedia.delete(true);
            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
            sentPdfMedia.delete(true);
            throw error;
        }

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur WhatsApp invitation invité :',
            error
        );

        throw error;
    }
};

/**
 * Envoi PDF par WhatsApp
 */
//sendPdfByEmail
const sendPdfByWhatsapp = async (data, pdfBuffer) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    const user = data;
    const event = data;

    if (!user.phone) {
        throw new Error('Numéro WhatsApp introuvable');
    }

    /**
     * Nettoyage du numéro
     */
    const numero = user.phone.replace(/\D/g, '');

    const numberId = await client.getNumberId(numero);

    if (!numberId) {
        throw new Error('Numéro WhatsApp invalide');
    }

    const chatId = numberId._serialized;

    /**
     * Message WhatsApp
     */
    const caption = `📩 *Liste récapitulative des invités*

    Bonjour ${user.name || ''},

    Veuillez trouver ci-joint le récapitulatif des invités pour l'événement :

    🎉 *${event.title}*

    Cordialement,
    Smart Invite

             ━━━━━━━━━━━━━━━
            _ smart-invite.com _
    `;

    try {
        /**
         * Conversion Buffer -> Base64
         */
        const base64Pdf = pdfBuffer.toString('base64');

        /**
         * Création média PDF
         */
        const media = new MessageMedia( 'application/pdf', base64Pdf, 'recapitulatif_invites.pdf');

        /**
         * Envoi PDF
         */
        await client.sendMessage( chatId, media, { caption } );

        /**
         * Notification interne
         */
        await createNotification(
            event.eventId,
            `Votre liste d'invités récapitulative`,
            `Vous avez reçu par WhatsApp la liste de présence des invités.`,
            'info',
            false
        );

        //console.log(`✅ PDF WhatsApp envoyé à ${numero}`);

        return true;

    } catch (error) {

        console.error('Erreur envoi WhatsApp PDF :', error);

        throw error;
    }
};

//sendFileQRCodeMail
const sendFileQRCodeWhatsapp = async (data, qrCodeUrl) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    const guest = data;
    const event = data;

    if (!guest.phone_number) {
        throw new Error('Numéro WhatsApp introuvable');
    }

    /**
     * Nettoyage numéro
     */
    const numero = guest.phone_number.replace(/\D/g, '');

    try {

        /**
         * Vérifier si le numéro existe sur WhatsApp
         */
        const numberId = await client.getNumberId(numero);

        if (!numberId) {
            throw new Error('Numéro WhatsApp invalide');
        }

        const chatId = numberId._serialized;

        /**
         * Télécharger le QR Code
         */
        const qrResponse = await axios.get(qrCodeUrl, {
            responseType: 'arraybuffer'
        });

        /**
         * Conversion image --> base64
         */
        const qrBase64 = Buffer
            .from(qrResponse.data)
            .toString('base64');

        /**
         * Déterminer type événement
         */
        let article = '';
        let concerned = '';
        let eventType = '';

        switch (event.type) {

            case 'wedding':
                article = 'le ';
                eventType = 'mariage';
                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;
                break;

            case 'engagement':
                article = 'les ';
                eventType = 'fiançailles';
                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;
                break;

            case 'anniversary':
                article = "l'";
                eventType = 'anniversaire de mariage';
                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;
                break;

            case 'birthday':
                article = "l'";
                eventType = 'anniversaire';
                concerned = event.event_name_concerned1;
                break;

            default:
                article = "l'";
                eventType = 'événement';
                concerned = event.event_name_concerned1;
                break;
        }

        /**
         * Caption WhatsApp
         */
        const caption = `
            📩 *Votre QR-code d'accès*

            Bonjour *${guest.full_name}*,

            Votre QR-code d’accès pour ${article}${eventType} est joint à ce message.

            🎫 Ce QR-code servira de laissez-passer le jour de l’événement.

            ✨ Merci encore pour votre présence.

            Cordialement,
            *${concerned}*
        `;

        /**
         * Création image média
         */
        const media = new MessageMedia(
            'image/png',
            qrBase64,
            'qr-code.png'
        );

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(
            chatId,
            media,
            {
                caption
            }
        );

        //console.log(`✅ QR Code WhatsApp envoyé à ${numero}`);

        return true;

    } catch (error) {

        console.error('Erreur WhatsApp QR Code :', error);

        throw error;
    }
};

//formatFullName
function formatFullName(full_name) {
  if (!full_name) return '';
  
  return full_name.trim().replace(/\s+/g, '_');
}

//sendInvitationToGuest
const whatsappInvitationToGuest = async ( data, qrCodeUrl, pdfBuffer ) => {
    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }
    //console.log('###  data:', data);
    const guest = data;
    const event = data;

    if (!guest.phone_number) {
        throw new Error('Numéro WhatsApp introuvable');
    }

    /**
     * Nettoyage numéro
     */
    const numero = guest.phone_number.replace(/\D/g, '');

    try {

        /**
         * Vérifier numéro WhatsApp
         */
        const numberId = await client.getNumberId(numero);

        if (!numberId) {
            throw new Error('Numéro WhatsApp invalide');
        }

        const chatId = numberId._serialized;

        /**
         * Télécharger QR Code
         */
        const qrResponse = await axios.get(qrCodeUrl, {
            responseType: 'arraybuffer'
        });

        const qrBase64 = Buffer
            .from(qrResponse.data)
            .toString('base64');

        /**
         * Gestion PDF
         */
        let pdfBase64 = null;

        if (pdfBuffer != null) {
            pdfBase64 = pdfBuffer.toString('base64');
        } else {
            const eventInvNote = await getEventInvitNote(event.eventId);
            const pdfUrl = await getPdfUrlFromFirebase(
                `event_${event.eventId}_default_carte_${eventInvNote.code}.pdf`
            );
            const pdfResponse = await axios.get(pdfUrl, {
                responseType: 'arraybuffer'
            });

            pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
        }

        /**
         * Variables événement
         */
        let article = '';
        let sentence = '';
        let concerned = '';
        let eventType = '';
        let signature = '';

        switch (event.type) {

            case 'wedding':

                concerned =
                    `${event.event_name_concerned1} 💖 ${event.event_name_concerned2}`;

                article = 'au ';

                eventType =
                    `Mariage de ${concerned}`;

                sentence =
                    `Nous sommes ravis que vous ayez accepté notre invitation.`;

                signature =
                    `Les futurs mariés\n\n ${event.event_name_concerned1} 💍 ${event.event_name_concerned2}`;

                break;

            case 'engagement':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = 'aux ';

                eventType =
                    `Fiançailles de ${concerned}`;

                sentence =
                    `Nous sommes ravis que vous ayez accepté notre invitation.`;

                signature =
                    `*Les futurs mariés\n\n ${event.event_name_concerned1} 💍 ${event.event_name_concerned2}*`;

                break;

            case 'anniversary':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = "à l'";

                eventType =
                    `Anniversaire de mariage de ${concerned}`;

                sentence =
                    `Nous sommes ravis que vous ayez accepté notre invitation.`;

                signature = concerned;

                break;

            case 'birthday':

                concerned =
                    event.event_name_concerned1;

                article = "à l'";

                eventType =
                    `Anniversaire de ${concerned}`;

                sentence =
                    `Je suis ravi que vous ayez accepté mon invitation.`;

                signature = concerned;

                break;

            default:

                concerned =
                    event.event_name_concerned1;

                article = "à l'";

                eventType = 'événement';

                sentence =
                    `Merci d'avoir accepté notre invitation.`;

                signature = concerned;

                break;
        }

        /**
         * Message WhatsApp
         */
        const caption = `🎉 *Merci d'avoir confirmé votre présence !*\n
        Bonjour *${guest.full_name}*,

        💖 ${sentence}

        Votre présence compte énormément pour nous ❤️

        📎Vous trouverez ci-joint :

        ✅ votre invitation officielle  
        ✅ votre QR-code d’accès

        🎟️ *Merci de présenter votre QR-code à l’entrée de la soirée du banquet afin de faciliter votre accueil.*

        ✨ À très bientôt \n*${concerned}*

            _ smart-invite.com _
        `;

        /**
         * Création média QR Code
         */
        const qrMedia = new MessageMedia(
            'image/png',
            qrBase64,
            `${formatFullName(guest.full_name)}-qr-code.png`
        );

        /**
         * Création média PDF
         */
        const pdfMedia = new MessageMedia(
            'application/pdf',
            pdfBase64,
            `${formatFullName(guest.full_name)}-invitation.pdf`
        );

        /**
         * Envoi QR Code
         */
        const sentQrMedia = await client.sendMessage( chatId, qrMedia, { caption } );

        /**
         * Petit délai anti-spam
         */
        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );

        /**
         * Envoi PDF
         */
        const sentPdfMedia = await client.sendMessage( chatId, pdfMedia );

        try {
            // MAJ INVITATION AVEC CHAT ID POUR SUIVI RSVP
            const invitation = await getGuestInvitationById(guest.guest_id);
            //console.log('### Invitation:', invitation);
            await updateInvitationByChatId(invitation[0].id, chatId, true);
        } catch (error) {
            console.error( '[getGuestInvitationById/updateInvitationByChatId] Error:', error );
            sentQrMedia.delete(true);
            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
            sentPdfMedia.delete(true);
            throw error;
        }

        //console.log( `✅ Invitation WhatsApp envoyée à ${numero}` );

        return true;

    } catch (error) {
        console.error( '.#Whatsapp Error:', error );
        throw error;
    }
};

//sendMailToAdmin
const sendWhatsappToAdmin = async ( name, email, phone, subject, message ) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    /**
     * Numéro admin depuis .env
     */
    const adminPhone =
        process.env.ADMIN_PHONE?.replace(/\D/g, '');

    if (!adminPhone) {
        throw new Error(
            'Numéro WhatsApp admin introuvable'
        );
    }

    try {

        /**
         * Vérifier numéro WhatsApp admin
         */
        const numberId = await client.getNumberId(adminPhone);
        if (!numberId) {
            throw new Error( 'Numéro WhatsApp admin invalide' );
        }
        const chatId = numberId._serialized;

        /**
         * Sujet formaté
         */
        let subj = '';

        switch (subject) {

            case 'support':
                subj = 'Support technique';
                break;

            case 'sales':
                subj = 'Demande commerciale';
                break;

            case 'partnership':
                subj = 'Partenariat';
                break;

            case 'feedback':
                subj = "Retour d'expérience";
                break;

            case 'other':
                subj = 'Autre';
                break;

            default:
                subj = 'Nouveau message';
                break;
        }

        /**
         * Message WhatsApp
         */
        const whatsappMessage = `📩 *Nouveau message de contact*

        👤 *Nom :*${name}

        📧 *Email :* email}

        📱 *Téléphone :*${phone || 'Non renseigné'}

        📝 *Sujet :*${subj}

        💬 *Message :*${message}

        ━━━━━━━━━━━━━━━
        _ smart-invite.com _
        `;

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(
            chatId,
            whatsappMessage
        );

        //console.log('✅ Message WhatsApp envoyé à Admin SmartInvite');

        return true;

    } catch (error) {

        console.error(
            'Erreur WhatsApp Admin :',
            error
        );

        throw error;
    }
};

//sendPaymentProofToAdminAboutChangePlan
const whatsappPaymentProofToAdminAboutChangePlan = async ( user, planName, fileBuffer ) => {
    
    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    try {

        /**
         * Numéro admin
         */
        const adminPhone =
            process.env.ADMIN_PHONE?.replace(/\D/g, '');

        if (!adminPhone) {
            throw new Error(
                'Numéro WhatsApp admin introuvable'
            );
        }

        /**
         * Vérifier numéro admin
         */
        const numberId =
            await client.getNumberId(adminPhone);

        if (!numberId) {
            throw new Error(
                'Numéro WhatsApp admin invalide'
            );
        }

        const chatId = numberId._serialized;

        /**
         * Lien admin
         */
        const adminLink =
            `${process.env.API_URL}/admin`;

        /**
         * Conversion preuve paiement -> base64
         */
        const fileBase64 =
            fileBuffer.toString('base64');

        /**
         * Création image/media
         */
        const media = new MessageMedia(
            'image/png',
            fileBase64,
            `${formatFullName(user.name)}-payment-proof.png`
        );

        /**
         * Message WhatsApp
         */
        const caption = `✨ *Nouvelle demande de changement de plan*

        👤 *Utilisateur :*
        ${user.name}

        📧 *Email :*
        ${user.email}

        📦 *Plan actuel :*
        ${user.plan}

        🚀 *Nouveau plan demandé :*
        ${planName}

        📎 Une preuve de paiement est jointe à ce message.

        Merci de vérifier et valider la demande.

        🔗 Accès administration :
        ${adminLink}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        _ smart-invite.com _
        `;

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(chatId, media, { caption } );
        //console.log(`✅ Preuve paiement WhatsApp envoyée à Admin`);

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur WhatsApp changement plan :',
            error
        );

        throw error;
    }
};

const whatsappPaymentStatusToUser = async ( user, event, status, reason ) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    try {

        /**
         * Vérification numéro utilisateur
         */
        if (!user.phone) {
            throw new Error(
                'Numéro WhatsApp utilisateur introuvable'
            );
        }

        /**
         * Nettoyage numéro
         */
        const numero =
            user.phone.replace(/\D/g, '');

        /**
         * Vérifier numéro WhatsApp
         */
        const numberId =
            await client.getNumberId(numero);

        if (!numberId) {
            throw new Error(
                'Numéro WhatsApp invalide'
            );
        }

        const chatId = numberId._serialized;

        /**
         * Lien pricing
         */
        const pricingLink =
            `${process.env.API_URL}/payment`;

        /**
         * Message WhatsApp
         */
        let whatsappMessage = '';

        if (status === 'validated') {

            whatsappMessage = `
        🎉 *Paiement validé*

        Bonjour *${user.name}*,

        Nous avons le plaisir de vous informer que votre paiement pour l'événement :

        📅 *${event.title}*

        a été validé avec succès.

        Vous pouvez désormais accéder à toutes les fonctionnalités associées à votre événement et générer vos liens d'invitation.

        Merci de faire confiance à *Smart Invite*.

        ━━━━━━━━━━━━━━━
        smart-invite.com
        `;

        } else {

            whatsappMessage = `
        ❌ *Paiement refusé*

        Bonjour *${user.name}*,

        Après vérification, nous ne pouvons malheureusement pas valider votre preuve de paiement pour l'événement :

        📅 *${event.title}*

        📌 *Motif du refus :*
        ${reason || 'Non précisé'}

        Nous vous invitons à soumettre une nouvelle preuve de paiement afin que votre demande puisse être réexaminée.

        Si vous estimez qu'il s'agit d'une erreur, n'hésitez pas à contacter notre support.

        Merci de votre compréhension.

        ━━━━━━━━━━━━━━━
        smart-invite.com
        `;
        }


        /**
         * Fallback
         */
        if (!whatsappMessage) {

            whatsappMessage = `
                📩 *Notification Smart Invite*

                Bonjour *${user.name}*,

                Votre paiement a été validé/rejété avec succès.

                ━━━━━━━━━━━━━━━
                Smart Invite
            `;
        }

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(
            chatId,
            whatsappMessage
        );

        //console.log(`✅ Notification WhatsApp envoyée à ${user.name}`);

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur WhatsApp notification plan :',
            error
        );

        throw error;
    }
};

//sendReminderMail
const sendReminderWhatsapp = async ( guest, event ) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    try {

        /**
         * Vérification numéro
         */
        if (!guest.phone_number) {

            throw new Error(
                'Numéro WhatsApp invité introuvable'
            );
        }

        /**
         * Validation format numéro
         */
        const rawNumber =
            guest.phone_number.trim();

        const phoneRegex =
            /^\+[1-9][0-9]{7,14}$/;

        if (!phoneRegex.test(rawNumber)) {

            throw new Error(
                'Format numéro invalide'
            );
        }

        /**
         * Nettoyage numéro
         */
        const numero =
            rawNumber.replace('+', '');

        /**
         * Vérification WhatsApp
         */
        const numberId =
            await client.getNumberId(numero);

        if (!numberId) {

            throw new Error(
                'Numéro WhatsApp invalide'
            );
        }

        const chatId =
            numberId._serialized ||
            `${numero}@c.us`;

        /**
         * RSVP LINK
         */
        const rsvpLink =
            `${process.env.API_URL}/invitations/${event.invitationToken}`;

        /**
         * Variables événement
         */
        let article = '';
        let concerned = '';
        let eventType = '';
        let signature = '';

        switch (event.type) {

            case 'wedding':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = 'au ';

                eventType =
                    `Mariage de ${concerned}`;

                signature =
                    `Les futurs mariés ${event.event_name_concerned1} 💍 ${event.event_name_concerned2}`;

                break;

            case 'engagement':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = 'aux ';

                eventType =
                    `Fiançailles de ${concerned}`;

                signature =
                    `Les futurs mariés ${event.event_name_concerned1} 💍 ${event.event_name_concerned2}`;

                break;

            case 'anniversary':

                concerned =
                    `${event.event_name_concerned1} et ${event.event_name_concerned2}`;

                article = "à l'";

                eventType =
                    `Anniversaire de mariage de ${concerned}`;

                signature = concerned;

                break;

            case 'birthday':

                concerned =
                    event.event_name_concerned1;

                article = "à l'";

                eventType =
                    `Anniversaire de ${concerned}`;

                signature = concerned;

                break;

            default:

                concerned =
                    event.event_name_concerned1;

                article = "à l'";

                eventType = 'événement';

                signature = concerned;

                break;
        }

        /**
         * Date formatée
         */
        const formattedDate =
            new Date(event.eventDate)
                .toLocaleDateString(
                    'fr-FR',
                    {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    }
                );

        /**
         * Message WhatsApp
         */
        const whatsappMessage = `🔔 *Rappel de confirmation*

        Bonjour *${guest.full_name}*,

        Nous espérons que vous allez bien 😊

        Vous aviez été invité(e) ${article}
        *${eventType}* prévu le
        *${formattedDate}*
        📍 ${event.eventLocation}

        Nous n’avons pas encore reçu votre réponse.

        Merci de confirmer votre présence en cliquant sur le lien ci-dessous :

        📩 *Répondre à l'invitation*
        ${rsvpLink}

        Si le lien ne fonctionne pas, copiez-le simplement dans votre navigateur.

        ━━━━━━━━━━━━━━━

        👉 A défaut, Répondez simplement à ce message whatsapp par :

        ✅ *OUI* : si vous serez présent(e)
        ❌ *NON* : si vous ne pourrez pas venir
        ❓ *PEUT-ÊTRE* : si vous n’êtes pas encore sûr(e)

        ━━━━━━━━━━━━━━━

        Merci d’avance pour votre retour 🙏

        Au plaisir de vous compter parmi nous ❤️

        *${signature}*

        ━━━━━━━━━━━━━━━
        _ smart-invite.com _
        `.trim();

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(
            chatId,
            whatsappMessage
        );

        //console.log(`✅ WhatsApp(Rappel) envoyé à ${guest.full_name}`);

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur WhatsApp rappel :',
            error.message
        );

        throw error;
    }
};

//sendGuestResponseToOrganizer
const whatsappGuestResponseToOrganizer = async ( organizer, guest, rsvpStatus ) => {
    //console.log('&&&&organizer:', organizer);
    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    try {

        /**
         * Vérification numéro organisateur
         */
        if (!organizer.phone) {
            throw new Error(
                'Numéro WhatsApp organisateur introuvable'
            );
        }

        /**
         * Nettoyage numéro
         */
        const numero =
            organizer.phone.replace(/\D/g, '');

        /**
         * Vérifier numéro WhatsApp
         */
        const numberId =
            await client.getNumberId(numero);

        if (!numberId) {
            throw new Error(
                'Numéro WhatsApp organisateur invalide'
            );
        }

        const chatId = numberId._serialized;

        /**
         * Etat RSVP
         */
        let subject = '';
        let responseText = '';
        let emoji = '';

        switch (rsvpStatus) {

            case 'confirmed':

                subject = '✅ Réponse invité';

                responseText = `vient d'accepter votre invitation`;

                emoji = '🎉';

                break;

            case 'declined':

                subject = '❌ Réponse invité';

                responseText =   `a décliné votre invitation`;

                emoji = '😔';

                break;

            default:

                subject = 'ℹ️ Réponse invité';

                responseText =
                    `a répondu à votre invitation`;

                emoji = '📩';

                break;
        }

        /**
         * Message WhatsApp
         */
        const whatsappMessage = `${subject}

        Bonjour *${organizer.name}* 👋

        L'invité *${guest.full_name}* ${responseText} ${emoji}

        📌 Pensez à mettre à jour ses informations et son numéro de table dans votre espace organisateur.

            ━━━━━━━━━━━━━━━
            _ smart-invite.com _
        `;

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(
            chatId,
            whatsappMessage
        );

        //console.log(`✅ Notification WhatsApp RSVP envoyée à ${organizer.name}`);

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur WhatsApp RSVP organisateur :',
            error.message
        );

        throw error;
    }
};

//sendGuestPresenceToOrganizer
const whatsappGuestPresenceToOrganizer = async ( organizer, guest ) => {

    if (!isReady) {
        throw new Error('WhatsApp non prêt');
    }

    try {

        /**
         * Vérification numéro organisateur
         */
        if (!organizer.phone) {
            throw new Error(
                'Numéro WhatsApp organisateur introuvable'
            );
        }

        /**
         * Nettoyage numéro
         */
        const numero =
            organizer.phone.replace(/\D/g, '');

        /**
         * Vérification numéro WhatsApp
         */
        const numberId =
            await client.getNumberId(numero);

        if (!numberId) {
            throw new Error(
                'Numéro WhatsApp organisateur invalide'
            );
        }

        const chatId = numberId._serialized;

        /**
         * Heure d'arrivée
         */
        const arrivalTime =
            new Date().toLocaleTimeString(
                'fr-FR',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            );

        /**
         * Message WhatsApp
         */
        const whatsappMessage = `
        ✅ *Arrivée d'un invité*

        Bonjour *${organizer.name}* 👋

        📍 L'invité *${guest.full_name}* vient d'arriver à votre événement.

        🕒 Heure d'arrivée : *${arrivalTime}*

        ━━━━━━━━━━━━━━━
        _ smart-invite.com _
        `;

        /**
         * Envoi WhatsApp
         */
        await client.sendMessage(
            chatId,
            whatsappMessage
        );

        //console.log(`✅ Notification présence envoyée à ${organizer.name}`);

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur WhatsApp présence organisateur :',
            error.message
        );

        throw error;
    }
};

//sendMailToAdminFromPortfolio
async function sendWhatsappToAdminFromPortfolio( name, email, message, subject) {
  try {
    const whatsappMessage = `
    📩 *Nouveau message depuis le Portfolio*

    ━━━━━━━━━━━━━━━

    👤 *Nom :* ${name}
    📧 *Email :* ${email}
    📝 *Sujet :* ${subject}

    💬 *Message :*
    ${message}

    ━━━━━━━━━━━━━━━

    🌐 Will Portfolio
    `.trim();

    await client.messages.create({
      from: `whatsapp:${process.env.ADMIN_PHONE}`,
      to: `whatsapp:${process.env.ADMIN_PHONE}`,
      body: whatsappMessage
    });

    //console.log(`✅ Message WhatsApp(Contact Us) envoyé à Admin Portfolio`);

  } catch (error) {
    console.error(
      '❌ Erreur envoi WhatsApp Admin Portfolio:',
      error.message
    );

    throw error;
  }
}

//manualSendThankYouMailToPresentGuests
async function manualSendThankYouWhatsappToPresentGuests( eventId, thankMessage, guest ) {
  try {
    const msg = thankMessage;
    const whatsappMessage = `
    💌 *Message de remerciement*

    Bonjour *${guest.full_name}* 👋

    ${msg}

    ━━━━━━━━━━━━━━━
    _ smart-invite.com _
    `.trim();

    // Nettoyage du numéro
    const phone = guest.phone_number.replace(/\D/g, "");

    // Format whatsapp-web.js
    const chatId = `${phone}@c.us`;

    //console.log("chatId:", chatId);

    await client.sendMessage(chatId, whatsappMessage);

    //console.log( `✅ Message WhatsApp de remerciement envoyé à ${guest.phone_number}` );

    return true;

  } catch (error) {
    console.error(
      "❌ Erreur envoi WhatsApp de remerciement:",
      error.response?.body || error.message
    );

    return false;
  }
}

//notifyOrganizerAboutSendThankYouMailToPresentGuests
async function notifyOrganizerAboutSendThankYouWhatsappToPresentGuests( organizer ) {
  try {
    const whatsappMessage = `
    ✅ *Rapport d'envoi du message automatique*

    Bonjour *${organizer.name}* 👋

    Le message de remerciement automatique a bien été envoyé à tous les invités présents 🎉

    ━━━━━━━━━━━━━━━

    Merci d’utiliser *SmartInvite* pour l’organisation de vos événements ❤️

    ━━━━━━━━━━━━━━━
    _ smart-invite.com _
    `.trim();

    await client.messages.create({
      from: `whatsapp:${process.env.ADMIN_PHONE}`,
      to: `whatsapp:${organizer.phone_number}`,
      body: whatsappMessage,
    });

    //console.log(`✅ WhatsApp(Report of thank-message) envoyé à ${organizer.phone_number}`);

    return true;

  } catch (error) {
    console.error(
      "❌ Erreur envoi WhatsApp rapport organisateur:",
      error.response?.body || error.message
    );

    return false;
  }
}

async function whatsappNotifications(schedules, organizer) {
  try {
    const schedule_bd = await getEventScheduleByEventId(
      schedules.event_id
    );

    //console.log('schedule_bd: ', schedule_bd);

    if (!schedule_bd.is_checkin_executed) {

      //console.log('is_checkin_executed: ', schedule_bd.is_checkin_executed);

      const scheduleId = schedule_bd.id;

      const updatedSchedule = await updateEventSchedule(
        scheduleId,
        schedule_bd.event_id,
        schedules.scheduled_for,
        true,
        true
      );

      //console.log('updatedSchedule : ', updatedSchedule);

      await createNotification(
        schedules.event_id,
        `Rapport d'envoi du message automatique`,
        `Le message de remerciement automatique a bien été envoyé a tous les invités présents.`,
        'info',
        false
      );

      await notifyOrganizerAboutSendThankYouWhatsappToPresentGuests(
        organizer
      );

    } else {

      //console.log('.### Notification WhatsApp déjà envoyée...');

    }

  } catch (error) {

    throw new Error(
      "whatsappNotifications error : " + error.message
    );

  }
}

//sendThankYouMailToPresentGuests
async function sendThankYouWhatsappToPresentGuests( event, schedules, organizer, guest ) {
  try {

    let sentences = '';
    let sentences_2 = '';
    let sentences_3 = '';
    let concerned = '';
    let eventType = '';

    switch (event.type) {

      case 'wedding':
        eventType = 'mariage';
        sentences =
          `Nous tenons à vous remercier chaleureusement pour votre présence à notre ${eventType}`;
        sentences_2 =
          "Nous espérons vous revoir très bientôt lors de nos prochaines rencontres.";
        sentences_3 =
          "Avec nos sincères remerciements,";
        concerned =
          `Le couple ${event.event_name_concerned1} et ${event.event_name_concerned2}`;
        break;

      case 'engagement':
        eventType = 'fiançailles';
        sentences =
          `Nous tenons à vous remercier chaleureusement pour votre présence à nos ${eventType}`;
        sentences_2 =
          "Nous espérons vous revoir très bientôt lors de nos prochaines rencontres.";
        sentences_3 =
          "Avec nos sincères remerciements,";
        concerned =
          `Les futurs mariés ${event.event_name_concerned1} et ${event.event_name_concerned2}`;
        break;

      case 'anniversary':
        eventType = 'anniversaire de mariage';
        sentences =
          `Nous tenons à vous remercier chaleureusement pour votre présence à notre ${eventType}`;
        sentences_2 =
          "Nous espérons vous revoir très bientôt lors de nos prochaines rencontres.";
        sentences_3 =
          "Avec nos sincères remerciements,";
        concerned =
          `Le couple ${event.event_name_concerned1} et ${event.event_name_concerned2}`;
        break;

      case 'birthday':
        eventType = 'anniversaire';
        sentences =
          `Je tiens à vous remercier chaleureusement pour votre présence à mon ${eventType}`;
        sentences_2 =
          "J'espère vous revoir très bientôt lors de nos prochaines rencontres.";
        sentences_3 =
          "Avec mes sincères remerciements,";
        concerned = event.event_name_concerned1;
        break;
    }

    const whatsappMessage = `
    💌 *Message de remerciement*

    Bonjour *${guest.full_name}* 👋

    ${sentences}

    ✨ Votre participation a contribué à rendre cet événement mémorable.

    ${sentences_2}

    ${sentences_3}

    *${concerned}*

    ━━━━━━━━━━━━━━━
    ❤️ Merci pour votre présence

    ━━━━━━━━━━━━━━━
    _ smart-invite.com _
    `.trim();

    // Nettoyage du numéro
    const phone = guest.phone_number.replace(/\D/g, "");

    // Format whatsapp-web.js
    const chatId = `${phone}@c.us`;

    //console.log("chatId:", chatId);

    await client.sendMessage(chatId, whatsappMessage);

    //console.log(`✅ Message WhatsApp de remerciement envoyé à ${guest.phone_number}`);

    return true;

  } catch (error) {

    console.error(
      "❌ Erreur envoi WhatsApp de remerciement:",
      error.response?.body || error.message
    );

    return false;
  }
}

//sendPdfToGuestMail
async function sendWhatsappPdfToGuest(data) {
  const guest = data.guest;
  const pdfBuffer = data.buffer;

  try {

    if (!guest?.phone_number) {
      throw new Error("Numéro WhatsApp de l'invité manquant");
    }

    if (!pdfBuffer) {
      throw new Error("Buffer PDF manquant");
    }

    // Upload PDF temporaire/public requis pour WhatsApp
    const pdfUrl = await uploadPdfAndGetPublicUrl(
      pdfBuffer,
      `${formatFullName(guest.full_name)}-invitation.pdf`
    );

    const whatsappMessage = `
    📩 *Votre invitation officielle*

    Bonjour *${guest.full_name}* 👋

    Votre invitation officielle est prête ✨

    📄 Téléchargez votre invitation PDF ici :
    ${pdfUrl}

    Nous serons ravis de vous compter parmi nous ❤️

    ━━━━━━━━━━━━━━━
    _ SmartInvite _
    `.trim();

    await client.messages.create({
      from: `whatsapp:${process.env.ADMIN_PHONE}`,
      to: `whatsapp:${guest.phone_number}`,
      body: whatsappMessage,
    });

    //console.log(`✅ Invitation PDF WhatsApp envoyée à ${guest.phone_number}`);

    return true;

  } catch (error) {

    console.error(
      "[sendWhatsappPdfToGuest] WHATSAPP ERROR:",
      error.response?.body || error.message
    );

    throw error;
  }
}

module.exports = {
    client, getIsReady: () => isReady,
    sendMessage,
    sendGuestWhatsapp,
    sendPdfByWhatsapp,
    sendReminderWhatsapp,
    sendFileQRCodeWhatsapp,
    whatsappInvitationToGuest,
    sendWhatsappToAdmin,
    sendWhatsappPdfToGuest,
    whatsappGuestResponseToOrganizer,
    whatsappGuestPresenceToOrganizer,
    whatsappPaymentProofToAdminAboutChangePlan,
    whatsappPaymentStatusToUser,
    sendWhatsappToAdminFromPortfolio,
    manualSendThankYouWhatsappToPresentGuests,
    notifyOrganizerAboutSendThankYouWhatsappToPresentGuests,
    sendThankYouWhatsappToPresentGuests
};