const express = require('express');
const router = express.Router();
const multerConfig = require('../middlewares/upload');
const EventController = require('../controllers/event.controller');
const PaymentController = require('../controllers/payment.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

router.get("/", async (req, res) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).json({ error: "Missing image URL" });
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.set("Content-Type", response.headers.get("content-type"));

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(500).json({ error: "Failed to load image" });
  }
});

// router.post(
//     '/payment/proof',
//     authenticateToken,
//     multerConfig,
//     PaymentController.addProofPaymentFile
// );

router.post(
    '/create-event-file',
    authenticateToken, 
    multerConfig,
    EventController.createEventWithFile
);

router.put(
    '/update-event-file/:eventId',
    authenticateToken, 
    multerConfig,
    EventController.updateEventWithFile
);

module.exports = router;
