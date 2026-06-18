const express = require('express');
const router = express.Router();
const CheckinParamController = require('../controllers/checkin_param.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

router.post('/',authenticateToken, CheckinParamController.add_checkin_p);
router.get('/:eventId',authenticateToken, CheckinParamController.get_checkin_p);
router.put('/',authenticateToken, CheckinParamController.update_checkin_p);

module.exports = router;