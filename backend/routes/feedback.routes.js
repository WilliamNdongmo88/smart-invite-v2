const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/feedback.controller.js');

router.post('/feedback', FeedbackController.addFeedback);
router.get('/feedback/stats', FeedbackController.fetchFeedbackStats);
router.get('/feedback/recent', FeedbackController.fetchRecentFeedback);
router.put('/feedback/:id', FeedbackController.changeStatusFeedback);
router.post('/feedback-users', FeedbackController.getAllUsers);
router.post('/notification/send', FeedbackController.sendNotificationToUsers);

module.exports = router;