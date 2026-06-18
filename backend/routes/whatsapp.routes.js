const express = require('express');

const router = express.Router();

const whatsappController = require('../controllers/whatsapp.controller');

router.post(
    '/send',
    whatsappController.sendWhatsappMessage
);

module.exports = router;