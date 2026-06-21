require('dotenv').config();
const pool = require('../config/bd');

const PRICE_PER_GUEST = 52; // XAF

const initPaymentModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS PAYMENTS (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      event_id INT UNSIGNED NOT NULL,
      organizer_id INT UNSIGNED NOT NULL,
      paid_quota INT UNSIGNED NOT NULL DEFAULT 0,
      sent_invitations INT UNSIGNED NOT NULL DEFAULT 0,
      quota INT UNSIGNED NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      proof_url TEXT NULL,
      proof_file_type VARCHAR(10) NULL,
      proof_code VARCHAR(20) NULL,
      proof_reference VARCHAR(255) NULL,
      rejection_reason VARCHAR(500) NULL,
      validated_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE,
      FOREIGN KEY (organizer_id) REFERENCES USERS(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Table PAYMENTS prête !');
};


async function createEventPayment(eventId, organizerId, quota, paidQuota = 0) {
  if (quota <= 0) throw new Error('Le quota supplémentaire doit être positif');
  const amount = quota * PRICE_PER_GUEST;
  const [result] = await pool.query(
    `INSERT INTO PAYMENTS (event_id, organizer_id, paid_quota, quota, amount, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [eventId, organizerId, paidQuota, quota, amount]
  );
  return result.insertId;
}

async function getPaymentByEventId(eventId) {
  const [rows] = await pool.query(
    `SELECT * FROM PAYMENTS WHERE event_id = ? ORDER BY created_at DESC LIMIT 1`,
    [eventId]
  );
  return rows[0] || null;
}

async function getPaymentById(paymentId) {
  const [rows] = await pool.query(`SELECT * FROM PAYMENTS WHERE id = ?`, [paymentId]);
  return rows[0] || null;
}

async function getAllPendingPayments() {
  const [rows] = await pool.query(`
    SELECT
      p.*,
      e.title AS event_title,
      u.name AS organizer_name,
      u.email AS organizer_email
    FROM PAYMENTS p
    JOIN EVENTS e ON e.id = p.event_id
    JOIN USERS u ON u.id = p.organizer_id
    WHERE p.status IN ('pending', 'under_review')
    ORDER BY p.created_at DESC
  `);
  return rows;
}

async function submitPaymentProof(paymentId, proofUrl, proofFileType, proofCode, proofReference) {
  await pool.query(
    `UPDATE PAYMENTS
     SET proof_url=?, proof_file_type=?, proof_code=?, proof_reference=?, status='pending', rejection_reason=NULL
     WHERE id=?`,
    [proofUrl, proofFileType, proofCode, proofReference, paymentId]
  );
}

async function getAllPayments() {
  const [rows] = await pool.query(`
    SELECT
      p.*,
      e.title AS event_title,
      u.name AS organizer_name,
      u.email AS organizer_email
    FROM PAYMENTS p
    JOIN EVENTS e ON e.id = p.event_id
    JOIN USERS u ON u.id = p.organizer_id
    ORDER BY p.created_at DESC
  `);
  return rows;
}

async function updateEventPaymentsByEventId(eventId, maxGuest) {
  const [result] = await pool.query(
    `
      UPDATE PAYMENTS
      SET quota = ?
      WHERE event_id = ?
    `,
    [maxGuest, eventId]
  );

  return result;
}

async function updateStatusPayments(paymentId, status) {
  const [result] = await pool.query(
    `
      UPDATE PAYMENTS
      SET status = 'pending'
      WHERE id = ?
    `,
    [paymentId]
  );

  return result;
}

async function setUnderReview(paymentId) {
  await pool.query(`UPDATE PAYMENTS SET status='under_review' WHERE id=?`, [paymentId]);
}

async function validatePayment(paymentId) {
  await pool.query(
    `UPDATE PAYMENTS SET status='validated', validated_at=NOW() WHERE id=?`,
    [paymentId]
  );
}

async function rejectPayment(paymentId, reason) {
  await pool.query(
    `UPDATE PAYMENTS SET status='rejected', rejection_reason=? WHERE id=?`,
    [reason || 'Preuve de paiement invalide', paymentId]
  );
}

async function isPaymentValidated(eventId) {
  const [rows] = await pool.query(
    `SELECT
       COALESCE(SUM(quota), 0)            AS total_quota,
       COALESCE(SUM(sent_invitations), 0) AS total_sent
     FROM PAYMENTS
     WHERE event_id = ? AND status = 'validated'`,
    [eventId]
  );
  if (!rows.length) return false;
  const totalQuota = Number(rows[0].total_quota);
  const totalSent  = Number(rows[0].total_sent);
  if (totalQuota === 0) return false;
  return totalSent < totalQuota;
}

async function incrementSentInvitations(eventId) {
  const [result] = await pool.query(
    `UPDATE PAYMENTS
     SET sent_invitations = sent_invitations + 1
     WHERE event_id = ?
       AND status = 'validated'
       AND sent_invitations < quota
     ORDER BY validated_at ASC    
     LIMIT 1`,
    [eventId]
  );// ASC : consomme la plus ancienne en premier (FIFO)
  return result.affectedRows > 0;
}

async function resetPaymentForNewQuota(paymentId, newQuota, paidQuota) {
  const delta = newQuota - paidQuota;
  if (delta <= 0) throw new Error('Le nouveau quota doit être supérieur au quota déjà payé');
  const newAmount = delta * PRICE_PER_GUEST;
  await pool.query(
    `UPDATE PAYMENTS
     SET status='pending', paid_quota=?, quota=?, amount=?, validated_at=NULL,
         proof_url=NULL, proof_code=NULL, proof_reference=NULL, rejection_reason=NULL
     WHERE id=?`,
    [paidQuota, newQuota, newAmount, paymentId]
  );
}

async function deletePaymentProofFile(paymentId) {
  await pool.query(
    `UPDATE PAYMENTS SET proof_url=NULL, proof_file_type=NULL, proof_code=NULL WHERE id=?`,
    [paymentId]
  );
}

async function getValidatedQuota(eventId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(quota), 0) AS validated_quota
     FROM PAYMENTS
     WHERE event_id = ? AND status = 'validated'`,
    [eventId]
  );
  return Number(rows[0].validated_quota);
}

async function getTotalSentInvitations(eventId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(sent_invitations), 0) AS total_sent
     FROM PAYMENTS
     WHERE event_id = ? AND status = 'validated'`,
    [eventId]
  );
  return Number(rows[0].total_sent);
}

async function getFinancialStats() {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Une seule requête groupée par année et mois
  const [rows] = await pool.query(`
    SELECT
      YEAR(validated_at)  AS year,
      MONTH(validated_at) AS month,
      COUNT(*)            AS payment_count,
      SUM(amount)         AS revenue
    FROM PAYMENTS
    WHERE status = 'validated'
      AND validated_at IS NOT NULL
    GROUP BY YEAR(validated_at), MONTH(validated_at)
    ORDER BY year ASC, month ASC
  `);

  // Totaux globaux
  const [totals] = await pool.query(`
    SELECT
      COUNT(*)   AS total_payments,
      SUM(amount) AS total_revenue
    FROM PAYMENTS
    WHERE status = 'validated'
  `);

  const totalRevenue   = Number(totals[0].total_revenue  || 0);
  const totalPayments  = Number(totals[0].total_payments || 0);

  // Agrégation par année
  const byYear = {};
  for (const row of rows) {
    const y = row.year;
    if (!byYear[y]) byYear[y] = { year: y, revenue: 0, payment_count: 0, months: [] };
    byYear[y].revenue       += Number(row.revenue);
    byYear[y].payment_count += Number(row.payment_count);
    byYear[y].months.push({
      month:         Number(row.month),
      revenue:       Number(row.revenue),
      payment_count: Number(row.payment_count)
    });
  }

  // Revenus de l'année courante
  const currentYearData  = byYear[currentYear] || { revenue: 0, payment_count: 0, months: [] };

  // Revenus du mois courant
  const currentMonthData = currentYearData.months.find(m => m.month === currentMonth)
    || { revenue: 0, payment_count: 0 };

  return {
    total_revenue:          totalRevenue,
    total_payments:         totalPayments,
    current_year_revenue:   currentYearData.revenue,
    current_month_revenue:  currentMonthData.revenue,
    current_month_payments: currentMonthData.payment_count,
    by_year:   Object.values(byYear),
    by_month:  rows.map(r => ({
      year:          Number(r.year),
      month:         Number(r.month),
      revenue:       Number(r.revenue),
      payment_count: Number(r.payment_count)
    }))
  };
}

module.exports = {
  initPaymentModel,
  PRICE_PER_GUEST,
  createEventPayment,
  getAllPayments,
  updateEventPaymentsByEventId,
  updateStatusPayments,
  getPaymentByEventId,
  getPaymentById,
  getAllPendingPayments,
  submitPaymentProof,
  setUnderReview,
  validatePayment,
  rejectPayment,
  isPaymentValidated,
  incrementSentInvitations,
  resetPaymentForNewQuota,
  deletePaymentProofFile,
  getValidatedQuota,
  getTotalSentInvitations,
  getFinancialStats
};