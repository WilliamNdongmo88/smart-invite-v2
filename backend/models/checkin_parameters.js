require('dotenv').config();
const pool = require('../config/bd');

const initCheckin_ParametersModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS CHECKIN_PARAMETERS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_id INT UNSIGNED NOT NULL,
        automatic_capture BOOLEAN NOT NULL DEFAULT TRUE,
        confirmation_sound BOOLEAN NOT NULL DEFAULT TRUE,
        scanned_codes INT NOT NULL DEFAULT 0,
        scanned_success INT NOT NULL DEFAULT 0,
        scanned_errors INT NOT NULL DEFAULT 0,
        FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Table CHECKIN_PARAMETERS prête !');
};

async function createCheckinP(eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors) {
    const [result] = await pool.query(`
        INSERT INTO 
        CHECKIN_PARAMETERS (event_id, automatic_capture, confirmation_sound, scanned_codes, scanned_success, scanned_errors)
        VALUES(?,?,?,?,?,?)`, [eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors]);
    return result.insertId;
}

async function getCheckinPById(checkinParamId) {
    const [result] = await pool.query(`
        SELECT * FROM CHECKIN_PARAMETERS WHERE id=?
    `,[checkinParamId]);
    return result[0];
}

async function getCheckinPByEventId(eventId) {
    const [result] = await pool.query(`
        SELECT * FROM CHECKIN_PARAMETERS WHERE event_id=?
    `,[eventId]);
    return result[0];
}

async function updateCheckinP(eventId, automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors) {
    const [result] = await pool.query(`
        UPDATE CHECKIN_PARAMETERS
        SET automatic_capture=?, confirmation_sound=?, scanned_codes=?, scanned_success=?, scanned_errors=?
        WHERE event_id=?
    `,[automaticCapture, confirmationSound, scannedCodes, scannedSuccess, scannedErrors, eventId]);
    return result.insertId;
}

module.exports = {initCheckin_ParametersModel, createCheckinP, getCheckinPByEventId, getCheckinPById, updateCheckinP}