const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

router.get('/notifications', authenticateToken, NotificationController.getAllNotifications);
router.put('/read/:notifId', authenticateToken, NotificationController.updateNotification);
router.delete('/delete/:notifId', authenticateToken, NotificationController.deleteNotification);

module.exports = router;