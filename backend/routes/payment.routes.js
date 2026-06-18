const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const PaymentController = require('../controllers/payment.controller');
const { authenticateToken, requireRole } = require('../middlewares/jwtFilter');

// Calcul du montant
router.get('/calculate', PaymentController.calculateAmount);

// Initialiser un paiement pour un événement
router.post('/event', authenticateToken, PaymentController.initEventPayment);

// Soumettre la preuve de paiement (fichier + référence)
router.post('/event/proof', authenticateToken, upload, PaymentController.submitProof);

// Récupérer le paiement d'un événement
router.get('/event/:eventId', authenticateToken, PaymentController.getEventPayment);

// Admin — paiements en attente
router.get('/pending', authenticateToken, requireRole('admin'), PaymentController.getPendingPayments);

// Admin — marquer en cours de vérification
router.put('/:paymentId/review', authenticateToken, requireRole('admin'), PaymentController.markUnderReview);

// Admin — valider
router.put('/:paymentId/validate', authenticateToken, requireRole('admin'), PaymentController.validateEventPayment);

// Admin — rejeter
router.put('/:paymentId/reject', authenticateToken, requireRole('admin'), PaymentController.rejectEventPayment);

// Admin — history
router.get('/history', authenticateToken, requireRole('admin'), PaymentController.getAllPayments);

module.exports = router;