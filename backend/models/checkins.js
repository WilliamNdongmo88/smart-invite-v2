require('dotenv').config();
const pool = require('../config/bd');

const initCheckinModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS CHECKINS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_id INT UNSIGNED NOT NULL,
        guest_id INT UNSIGNED NOT NULL,
        invitation_id INT UNSIGNED NOT NULL,
        scanned_by VARCHAR(255),
        device_id VARCHAR(255),
        scan_status VARCHAR(50) NOT NULL,
        location VARCHAR(255),
        checkin_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE,
        FOREIGN KEY (guest_id) REFERENCES GUESTS(id) ON DELETE CASCADE,
        FOREIGN KEY (invitation_id) REFERENCES INVITATIONS(id) ON DELETE CASCADE,
        CONSTRAINT valid_scan_status CHECK (scan_status IN ('VALID', 'INVALID', 'DUPLICATE', 'EXPIRED'))
    )
  `);
  console.log('✅ Table CHECKINS prête !');
};


async function createCheckin(eventId, guestId, invitationId, scannedBy, scanStatus, checkinTime) {
    const safeEventId = eventId ?? null;// Pour éviter les undefined
    const safeGuestId = guestId ?? null;
    const safeInvitationId = invitationId ?? null;
    const safeScannedBy = scannedBy ?? null;
    const safeScanStatus = scanStatus ?? null;
    const safeCheckinTime = checkinTime ? new Date(checkinTime) : new Date();

    const [result] = await pool.query(
        `INSERT INTO CHECKINS (event_id, guest_id, invitation_id, scanned_by, scan_status, checkin_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [safeEventId, safeGuestId, safeInvitationId, safeScannedBy, safeScanStatus, safeCheckinTime]
    );

    return result.insertId;
}

async function getCheckinByInvitationId(invitationId) {
  const [result] = await pool.query(`SELECT * FROM CHECKINS WHERE invitation_id=?`,[invitationId]);
  return result[0];
}

async function getGuestsCheckIns() {
  const [result] = await pool.query(`SELECT * FROM CHECKINS`);
  return result;
}

async function getEventAndGuestInfoByGuestId(guestId) {
  const [rows] = await pool.execute(`
    SELECT
      c.id AS checkinId,
      c.scan_status,
      e.id AS eventId,
      e.title,
      e.event_location,
      e.event_date,
      e.organizer_id,
      g.id AS guestId,
      g.full_name AS guestName,
      g.email,
      g.table_number,
      g.phone_number,
      g.notification_mode,
      g.rsvp_status,
      g.plus_one_name_diet_restr,
      g.has_plus_one,
      g.plus_one_name,
      g.dietary_restrictions,
      u.id AS organizerId,
      u.email AS emailOrganizer
    FROM CHECKINS c
    JOIN GUESTS g ON g.id = c.guest_id
    JOIN EVENTS e ON c.event_id = e.id
    JOIN USERS u ON u.id = e.organizer_id
    WHERE g.id = ? AND c.scan_status IN ('VALID', 'DUPLICATE')
  `, [guestId]);

  return rows[0] || null;
}

async function updateCheckin(checkinId, eventId, invitationId, scannedBy, scanStatus, checkinTime) {
  const [result] = await pool.query(`
    UPDATE CHECKINS 
    SET event_id=?, invitation_id=?, scanned_by=?, scan_status=?, checkin_time=?
    WHERE id=?
  `,[eventId, invitationId, scannedBy, scanStatus, checkinTime, checkinId]);

  return result.insertId;
}

module.exports = {initCheckinModel, createCheckin, getGuestsCheckIns, 
  getCheckinByInvitationId, updateCheckin, getEventAndGuestInfoByGuestId};