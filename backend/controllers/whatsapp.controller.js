const whatsappService = require('../services/whatsapp.service');

const sendWhatsappMessage = async (req, res) => {

    try {
        const { numero, message } = req.body;
        await whatsappService.sendMessage(numero, message);
        res.status(200).json({
            success: true,
            message: 'Message envoyé'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Erreur envoi WhatsApp'
        });
    }
};

module.exports = {
    sendWhatsappMessage
};