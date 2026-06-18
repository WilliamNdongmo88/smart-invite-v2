const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');
const {
  startVisitorSession, trackPageView, endVisitorSession,
  getVisitors, getVisitorDetailCtrl, getStats, getPublicStats
} = require('../controllers/visitor.controller');

// Public
router.post('/start',       startVisitorSession);
router.post('/page-view',   trackPageView);
router.post('/end-session', endVisitorSession);
router.get('/public-stats', getPublicStats);

// Admin
router.get('/',                        authenticateToken, requireRole('admin'), getVisitors);
router.get('/stats',                   authenticateToken, requireRole('admin'), getStats);
router.get('/:visitorId',              authenticateToken, requireRole('admin'), getVisitorDetailCtrl);

module.exports = router;
