const express = require('express');
const router = express.Router();
const InvitationController = require('../controllers/invitation.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

router.post('/generate/:guestId', authenticateToken, InvitationController.genererInvitation);//, requireRole('admin')
router.post('/generate-several', authenticateToken, InvitationController.genererSeveralInvitations);//, requireRole('admin')
router.get("/view/:guestId", InvitationController.viewInvitation);
router.get("/download/:guestId", InvitationController.downloadQRCode);
router.get("/qrcode/view/:token", InvitationController.viewQrCode);
router.put("/rsvp-status/:token", InvitationController.rsvpGuestStatus);
router.delete("/delete/:guestId", InvitationController.deleteInvitation);

router.post("/attendee-qr", InvitationController.generateAttendeeQrCode);

module.exports = router;