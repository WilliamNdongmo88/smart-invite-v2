const express = require('express');
const router = express.Router();
const CheckinController = require('../controllers/checkin.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

router.post('/scan', authenticateToken, CheckinController.addCheckIn);
router.post('/scanned-guest', authenticateToken, CheckinController.getValidCheckIn);
router.post('/thank-message', authenticateToken, CheckinController.sendManualThankMessage);

module.exports = router;