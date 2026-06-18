require('dotenv').config();
const pool = require('../config/bd');

const initEventSchedulesModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS EVENT_SCHEDULES (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_id INT UNSIGNED NOT NULL,
        payment_id INT UNSIGNED NOT NULL,
        scheduled_for DATETIME NOT NULL,
        is_checkin_executed BOOLEAN NOT NULL DEFAULT FALSE,
        executed BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  console.log('✅ Table EVENT-SCHEDULE prête !');
};

async function createEventSchedule(eventId, scheduledFor, executed) {
    const [result] = await pool.query(`
        INSERT INTO EVENT_SCHEDULES (event_id, payment_id, scheduled_for, executed)
        VALUES(?,?,?,?)
    `,[eventId, 0, scheduledFor, executed]);

    return result.insertId;
}

async function createPaymentSchedule(paymentId, scheduledFor, executed) {
    const [result] = await pool.query(`
        INSERT INTO EVENT_SCHEDULES (event_id, payment_id, scheduled_for, executed)
        VALUES(?,?,?,?)
    `,[0, paymentId, scheduledFor, executed]);

    return result.insertId;
}

async function getEventScheduleByEventId(eventId) {
    const [result] = await pool.query(`
        SELECT * 
        FROM EVENT_SCHEDULES WHERE event_id=?
    `,[eventId]);

    return result[0];
}

async function updateEventSchedule(eventScheduledId, eventId, scheduledFor, executed, isCheckinExecuted) {
    const [result] = await pool.query(`
        UPDATE EVENT_SCHEDULES 
        SET event_id=?, scheduled_for=?, executed=?, is_checkin_executed=?
        WHERE id=?
    `,[eventId, scheduledFor, executed,isCheckinExecuted, eventScheduledId]);

    return eventScheduledId;
}

async function deleteEventSchedule(eventId) {
    await pool.query(`DELETE FROM EVENT_SCHEDULES WHERE id=?`, [eventId]);
}

module.exports = {
    initEventSchedulesModel, createEventSchedule, 
    getEventScheduleByEventId, updateEventSchedule, 
    deleteEventSchedule, createPaymentSchedule
};