const express = require('express');
const router = express.Router();
const MaintenanceController = require('../controllers/maintenance.controller');
const { authenticateToken } = require('../middlewares/jwtFilter');

router.get('/', authenticateToken, MaintenanceController.getTableMaintenance);
router.post('/restart', authenticateToken, MaintenanceController.restartSchedule);
router.post('/notification/send', authenticateToken, MaintenanceController.sendNotification);
router.put('/:id', authenticateToken, MaintenanceController.updateTableMaintenance);

module.exports = router;