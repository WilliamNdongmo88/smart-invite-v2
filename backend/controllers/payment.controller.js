const {
  createEventPayment, getPaymentByEventId, getPaymentById,
  getAllPendingPayments, submitPaymentProof, setUnderReview,
  validatePayment, rejectPayment, isPaymentValidated,
  resetPaymentForNewQuota, deletePaymentProofFile,
  getValidatedQuota, PRICE_PER_GUEST,getTotalSentInvitations,
  getAllPayments: getAllPaymentsModel,updateStatusPayments
} = require('../models/payment');
const { getEventById } = require('../models/events');
const { getUserById } = require('../models/users');
const { uploadPaymentProofToFirebase, deletePaymentProofFromFirebase } = require('../services/pdfService');
const { sendPaymentProofNotificationToAdmin, sendPaymentStatusToUser } = require('../services/notification.service');
const { whatsappPaymentStatusToUser } = require('../services/whatsapp.service');

// Calculer le montant pour un quota donné
const calculateAmount = async (req, res, next) => {
  try {
    const quota = Number(req.query.quota);
    const eventId = req.query.eventId ? Number(req.query.eventId) : null;

    if (!quota || quota <= 0) return res.status(400).json({ error: 'Quota invalide' });

    let paidQuota = 0;
    if (eventId) {
      paidQuota = await getValidatedQuota(eventId);
    }

    const delta = quota - paidQuota;
    if (delta <= 0) {
      return res.status(400).json({
        error: 'Le nouveau quota est inférieur ou égal au quota déjà payé'
      });
    }

    return res.status(200).json({
      quota,
      paidQuota,
      delta,
      amount: delta * PRICE_PER_GUEST,
      currency: 'XAF'
    });
  } catch (error) { next(error); }
};

// Créer un enregistrement de paiement pour un événement (sans preuve encore)
const initEventPayment = async (req, res, next) => {
  try {
    console.log("req.body: ", req.body);
    const { eventId, quota } = req.body;
    
    if (!eventId || !quota || quota <= 0) {
      return res.status(400).json({ error: 'eventId et quota (> 0) sont requis' });
    }
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    if (event.organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const existing = await getPaymentByEventId(eventId);

    if (existing && existing.status === 'validated') {
      const paidQuota = await getValidatedQuota(eventId);

      // quota envoyé par le frontend (nombre d'invités supplémentaires)
      if (quota <= 0) {
        return res.status(400).json({ error: 'Le nouveau quota doit être positif' });
      }
      const paymentId = await createEventPayment(eventId, event.organizer_id, quota, paidQuota);
      const payment = await getPaymentById(paymentId);
      return res.status(201).json({ payment });
    }

    if (existing && existing.status === 'rejected') {
      // Paiement précédent rejeté → mettre a jour le paiement
      //console.log("### existing : ", existing);
      const paymentId = await updateStatusPayments(existing.id);// Remêttre le status à "pending"
      const payment = await getPaymentById(paymentId);
      return res.status(201).json({ payment });
    }

    if (existing && (existing.status === 'pending' || existing.status === 'under_review')) {
      // Paiement en cours → retourner l'existant sans modification
      return res.status(200).json({ payment: existing });
    }

    // Aucun paiement existant → premier paiement
    const paymentId = await createEventPayment(eventId, event.organizer_id, quota, 0);
    const payment = await getPaymentById(paymentId);
    return res.status(201).json({ payment });

  } catch (error) { next(error); }
};

// Soumettre la preuve de paiement (upload fichier + référence)
const submitProof = async (req, res, next) => {
  try {
    const proofFile = req.file;
    const { eventId, proofReference } = req.body;

    if (!proofFile) return res.status(400).json({ error: 'Fichier de preuve requis' });
    if (!eventId) return res.status(400).json({ error: 'eventId requis' });

    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    if (event.organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Récupérer ou créer le paiement
    let payment = await getPaymentByEventId(eventId);
    if (!payment) {
      return res.status(404).json({ error: 'Aucun paiement initialisé pour cet événement' });
    }
    if (payment.status === 'validated') {
      return res.status(409).json({ error: 'Ce paiement est déjà validé' });
    }

    // Supprimer l'ancienne preuve si elle existe
    if (payment.proof_url && payment.proof_code) {
      await deletePaymentProofFromFirebase(event.organizer_id, payment.proof_code, payment.proof_file_type);
    }

    // Uploader la nouvelle preuve
    const user = await getUserById(event.organizer_id);
    const uploaded = await uploadPaymentProofToFirebase(proofFile, user, eventId);

    await submitPaymentProof(
      payment.id,
      uploaded.url,
      uploaded.fileType,
      uploaded.code,
      proofReference || null
    );

    // Notifier l'admin
    const updatedPayment = await getPaymentById(payment.id);
    await sendPaymentProofNotificationToAdmin(user, event, updatedPayment);

    return res.status(200).json({ payment: updatedPayment });
  } catch (error) { next(error); }
};

// Récupérer tous les paiements d'un événement
const getAllPayments = async (req, res, next) => {
  try {
    const payments = await getAllPaymentsModel();
    return res.status(200).json({ payments });
  } catch (error) { next(error); }
};

// Récupérer le paiement d'un événement
const getEventPayment = async (req, res, next) => {
  try {
    const payment = await getPaymentByEventId(req.params.eventId);
    if (!payment) return res.status(200).json({ payment: null });

    const totalValidatedQuota   = await getValidatedQuota(req.params.eventId);
    const totalSentInvitations  = await getTotalSentInvitations(req.params.eventId);

    return res.status(200).json({
      payment: {
        ...payment,
        total_validated_quota:  totalValidatedQuota,
        total_sent_invitations: totalSentInvitations
      }
    });
  } catch (error) { next(error); }
};

// Admin — Récupérer tous les paiements en attente/en cours
const getPendingPayments = async (req, res, next) => {
  try {
    const payments = await getAllPendingPayments();
    return res.status(200).json({ payments });
  } catch (error) { next(error); }
};

// Admin — Passer un paiement en "under_review"
const markUnderReview = async (req, res, next) => {
  try {
    await setUnderReview(req.params.paymentId);
    return res.status(200).json({ message: 'Paiement en cours de vérification' });
  } catch (error) { next(error); }
};

// Admin — Valider un paiement
const validateEventPayment = async (req, res, next) => {
  try {
    const payment = await getPaymentById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable' });

    // Garde-fou : impossible de valider sans preuve
    if (!payment.proof_url) {
      return res.status(422).json({
        error: 'PROOF_REQUIRED',
        message: 'Impossible de valider un paiement sans preuve de paiement.'
      });
    }

    // Garde-fou : seuls pending et under_review sont validables
    if (!['pending', 'under_review'].includes(payment.status)) {
      return res.status(409).json({
        error: 'INVALID_STATUS',
        message: `Ce paiement ne peut pas être validé (statut : ${payment.status}).`
      });
    }

    await validatePayment(req.params.paymentId);

    const user = await getUserById(payment.organizer_id);
    const event = await getEventById(payment.event_id);
    if(user.notification_mode === 'email') await sendPaymentStatusToUser(user, event, 'validated', null);
    if(user.notification_mode === 'whatsapp') await whatsappPaymentStatusToUser(user, event, 'validated', null);

    return res.status(200).json({ message: 'Paiement validé avec succès' });
  } catch (error) { next(error); }
};

// Admin — Rejeter un paiement
const rejectEventPayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const payment = await getPaymentById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Paiement introuvable' });

    await rejectPayment(req.params.paymentId, reason);

    // Notifier l'utilisateur
    const user = await getUserById(payment.organizer_id);
    const event = await getEventById(payment.event_id);
    
    if(user.notification_mode === 'email') await sendPaymentStatusToUser(user, event, 'rejected', reason);
    if(user.notification_mode === 'whatsapp') await whatsappPaymentStatusToUser(user, event, 'rejected', reason);
    return res.status(200).json({ message: 'Paiement rejeté' });
  } catch (error) { next(error); }
};

module.exports = {
  calculateAmount,
  initEventPayment,
  submitProof,
  getAllPayments,
  getEventPayment,
  getPendingPayments,
  markUnderReview,
  validateEventPayment,
  rejectEventPayment,
};