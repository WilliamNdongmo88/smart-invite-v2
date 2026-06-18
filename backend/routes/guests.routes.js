const express = require('express');
const router = express.Router();
const GuestController = require('../controllers/guest.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

router.post('/add-guest',authenticateToken, GuestController.addGuest);//, requireRole('admin')
router.post('/add-guest-from-link', GuestController.addGuestFromLink);
router.get('/all-guests',authenticateToken, GuestController.getAllGuest);
router.get('/:guestId',authenticateToken, GuestController.getGuest);
router.get('/:guestId/event', GuestController.getEventByGuest);
router.get('/event/:eventId',authenticateToken, GuestController.getGuestsByEvent);
router.get('/event-info/:eventId',authenticateToken, GuestController.getUserByEvent);
router.put('/:guestId', GuestController.updateGuest);
router.put('/rsvp/:guestId',authenticateToken, GuestController.updateRsvpStatus);
router.delete('/:guestId',authenticateToken, GuestController.deleteGuest);
router.post('/delete',authenticateToken, GuestController.deleteSeveralGuests);
router.post('/reminde-mail',authenticateToken, GuestController.sendReminder);//, requireRole('admin')
router.post('/:guestId/send-file',authenticateToken, GuestController.sendFileQRCode);//, requireRole('admin')

module.exports = router;