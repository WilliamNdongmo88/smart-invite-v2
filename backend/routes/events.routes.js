const express = require('express');
const router = express.Router();
const EventController = require('../controllers/event.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Gestion des événements
 */

/**
 * @swagger
 * /api/event/create-event:
 *   post:
 *     summary: Ajouter un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReqDataEvent'
 *     responses:
 *       201:
 *         description: Événement créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResDataEvent'
 *       409:
 *         description: Organizer not found with ID:1
 */
router.post('/create-event',authenticateToken, EventController.create_Event);//, requireRole('admin')

router.post('/guest-pdf',authenticateToken, EventController.generatePresentGuests);//, requireRole('admin')

/**
 * @swagger
 * /api/event/all-events:
 *   get:
 *     summary: Récupération de tous les événements
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tous les événements récupérés avec succès
 *       500:
 *         description: Erreur serveur
 */
router.get('/all-events',authenticateToken, EventController.getAllEvents);

/**
 * @swagger
 * /api/event/{id}:
 *   get:
 *     summary: Récupération d'un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'événement à récupérer
 *     responses:
 *       200:
 *         description: Evénement récupéré avec succès
 *       500:
 *         description: Erreur serveur
 */
router.get('/:eventId', EventController.getEventBy_Id);

router.get('/event-inv-note/:eventId', EventController.getEventInvitationNote);

router.get('/:eventId/invitation',authenticateToken, EventController.getEventAndInvitationRelatedById);

/**
 * @swagger
 * /api/event/organizer/{id}:
 *   get:
 *     summary: Récupération des événements liés a un organizer
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'organisateur
 *     responses:
 *       200:
 *         description: Evénements récupérés avec succès
 *       404:
 *         description: Aucun Evénement trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/organizer/:organizerId',authenticateToken, EventController.getOrganizerEvents);

/**
 * @swagger
 * /api/event/{id}:
 *   put:
 *     summary: Mis à jour d'un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'événement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:     #multipart/form-data(J'ai une erreur a debugger plutard)
 *           schema:
 *             $ref: '#/components/schemas/ReqDataEvent'
 *     responses:
 *       200:
 *         description: Evénement mis à jour avec succès
 *       404:
 *         description: Cet Evénement n'existe pas
 *       500:
 *         description: Erreur serveur
 */
router.put('/:eventId',authenticateToken, EventController.updateEventBy_Id);

/**
 * @swagger
 * /api/event/status/{id}:
 *   put:
 *     summary: Mis à jour du status d'un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'événement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReqStatusEvent'
 *     responses:
 *       200:
 *         description: Status de l'événement mis à jour avec succès
 *       404:
 *         description: Aucun Evénement trouvé avec l'id
 *       500:
 *         description: Erreur serveur
 */
router.put('/status/:eventId',authenticateToken, EventController.updateEvent_Status);

/**
 * @swagger
 * /api/event/{id}:
 *   delete:
 *     summary: Suppréssion d'un événement
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'événement
 *     responses:
 *       200:
 *         description: Evénement supprimé avec succès!
 *       404:
 *         description: Evénement non trouvé!
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:eventId',authenticateToken, EventController.deleteEvent);

router.post('/send-report', authenticateToken, EventController.sendSReportManually);
router.post('/send-thank-msg', authenticateToken, EventController.sendSThankMessageManually);

module.exports = router;