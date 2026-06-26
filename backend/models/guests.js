require('dotenv').config();
const pool = require('../config/bd');
const { notifications } = require('../services/notification.service');

const initGuestModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS GUESTS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_id INT UNSIGNED NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone_number VARCHAR(20),
        rsvp_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        has_plus_one BOOLEAN NOT NULL DEFAULT false,
        plus_one_name VARCHAR(255),
        dietary_restrictions VARCHAR(255),
        plus_one_name_diet_restr VARCHAR(255),
        guest_has_plus_one_autorise_by_admin BOOLEAN NOT NULL DEFAULT false,
        notification_mode VARCHAR(50) NOT NULL DEFAULT 'email',
        notes TEXT,
        table_number VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE,
        CONSTRAINT valid_rsvp_status CHECK (rsvp_status IN ('pending', 'confirmed', 'declined', 'present'))
    )
  `);
  console.log('✅ Table GUESTS prête !');
};

// async function createGuest(eventId, fullName, email, phoneNumber, 
//             rsvpStatus, guesthasPlusOneAutoriseByAdmin) {
//     const [result] = await pool.execute(`INSERT INTO GUESTS (event_id, full_name, email, phone_number, 
//         rsvp_status, guest_has_plus_one_autorise_by_admin) VALUES(?,?,?,?,?,?)`, 
//         [eventId, fullName, email, phoneNumber, rsvpStatus, guesthasPlusOneAutoriseByAdmin]);
//     //console.log("[createGuest] result :: ", result.insertId);
//     return result.insertId;
// }
async function createGuest( 
    connection, eventId, fullName, email,
    phoneNumber, rsvpStatus, guesthasPlusOneAutoriseByAdmin, notificationMode
) {
    const [result] = await connection.query(
        `
        INSERT INTO GUESTS (
            event_id,
            full_name,
            email,
            phone_number,
            rsvp_status,
            guest_has_plus_one_autorise_by_admin,
            notification_mode
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [ 
            eventId, fullName, email, phoneNumber, rsvpStatus, 
            guesthasPlusOneAutoriseByAdmin, notificationMode
        ]
    );

    return result.insertId;
}

async function createGuestFromLink(
    eventId,fullName,email,phoneNumber,notificationMode, rsvpStatus,guestHasPlusOneAutoriseByAdmin,
    dietaryRestrictions,plusOneNameDietRestr,hasPlusOne,plusOneName
) {

    const [result] = await pool.execute(
        `
        INSERT INTO GUESTS (
            event_id,
            full_name,
            email,
            phone_number,
            notification_mode,
            rsvp_status,
            guest_has_plus_one_autorise_by_admin,
            dietary_restrictions,
            plus_one_name_diet_restr,
            has_plus_one,
            plus_one_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
        `,
        [
            eventId,fullName,email,phoneNumber,notificationMode, rsvpStatus,guestHasPlusOneAutoriseByAdmin,
            dietaryRestrictions,plusOneNameDietRestr,hasPlusOne,plusOneName
        ]
    );

    return result.insertId;
}

async function getGuestById(id) {
    const [guest] = await pool.execute(`
        SELECT 
            g.*,
            e.id AS eventId,
            e.type,
            e.title,
            e.description,
            e.has_plus_one AS hasPlusOne,
            e.foot_restriction,
            e.event_date,
            e.banquet_time,
            e.type,
            e.event_name_concerned1,
            e.event_name_concerned2,
            e.event_civil_location,
            e.religious_location,
            e.religious_time,
            e.show_wedding_religious_location,
            e.religious_location,
            e.religious_time,
            e.show_wedding_religious_location,
            e.event_location
        FROM GUESTS g
        LEFT JOIN EVENTS e ON e.id=g.event_id
        WHERE g.id=?`, [id]);
    return guest[0];
}

async function getGuestByEmail(email) {
    const [event] = await pool.execute(`SELECT * FROM GUESTS WHERE email=?`, [email]);
    return event[0];
}

async function getAllConfirmedGuests() {
    const [guests] = await pool.query(`SELECT * FROM GUESTS WHERE rsvp_status = ?`, ['confirmed']);
    return guests;
}

async function getGuestByEventId(eventId) {
    const [event] = await pool.query(`SELECT * FROM GUESTS WHERE event_id=?`, [eventId]);
    return event;
}

async function getGuestByEventIdAndConfirmedRsvp(eventId) {
    const [result] = await pool.query(`
        SELECT
            g.id AS guestId,
            g.full_name AS name,
            g.phone_number AS phone,
            g.plus_one_name AS plusOneName,
            g.rsvp_status AS rsvpStatus,
            g.updated_at AS updatedAt,
            g.notification_mode AS notificationMode,
            e.id AS eventId
        FROM GUESTS g
        LEFT JOIN EVENTS e ON e.id=g.event_id
        WHERE g.event_id=? AND g.rsvp_status=?
    `, [eventId, 'confirmed']);

    return result;
}

async function getAllPresentGuest(guestId) {
    const [result] = await pool.query(`
        SELECT
            g.id,
            g.full_name,
            g.email,
            g.phone_number,
            g.rsvp_status,
            g.notification_mode
        FROM GUESTS g
        WHERE id=? AND g.rsvp_status=?
    `, [guestId, 'present']);

    return result;
}

async function getEventByGuestId(guestId) {
    const result = await pool.query(`
        SELECT 
            g.id AS guestId,
            g.full_name AS guestName,
            g.email AS guestEmail,
            g.phone_number AS guestPhone,
            g.notification_mode,
            g.rsvp_status AS rsvpStatus,
            g.guest_has_plus_one_autorise_by_admin AS guestHasPlusOneAutoriseByAdmin,
            g.has_plus_one AS guestHasPlusOne,
            g.plus_one_name AS plusOneName,
            g.dietary_restrictions AS dietaryRestrictions,
            g.plus_one_name_diet_restr AS plusOneNameDietRestr,
            g.notes AS notes,
            e.id AS eventId,
            e.organizer_id AS organizerId,
            e.title AS eventTitle,
            e.description AS description,
            e.has_plus_one AS eventHasPlusOne,
            e.foot_restriction AS eventFootRestriction,
            e.event_date AS eventDate,
            e.banquet_time AS banquetTime,
            e.type,
            e.event_name_concerned1,
            e.event_name_concerned2,
            e.event_civil_location AS eventCivilLocation,
            e.religious_location AS religiousLocation,
            e.religious_time AS religiousTime,
            e.show_wedding_religious_location AS showWeddingReligiousLocation,
            e.event_location AS eventLocation,
            u.id AS organizerId,
            u.email AS emailOrganizer
        FROM GUESTS g
        LEFT JOIN EVENTS e ON e.id=g.event_id
        LEFT JOIN USERS u ON u.id=e.organizer_id
        WHERE g.id=?
    `, [guestId]);
    return result[0];
}

async function getGuestAndEventRelatedById(guestId) {
    const result = await pool.query(`
        SELECT 
            g.id AS guestId,
            g.full_name,
            g.email,
            g.phone_number,
            g.notification_mode,
            g.rsvp_status,
            g.plus_one_name,
            g.dietary_restrictions,
            g.plus_one_name_diet_restr,
            g.notes AS notes,
            e.id AS eventId,
            e.title AS event_title,
            e.description,
            e.event_date,
            e.banquet_time,
            e.type,
            e.event_name_concerned1,
            e.event_name_concerned2,
            e.event_civil_location,
            e.religious_location,
            e.religious_time,
            e.show_wedding_religious_location,
            e.event_location
        FROM GUESTS g
        LEFT JOIN EVENTS e ON e.id=g.event_id
        WHERE g.id=?
    `, [guestId]);
    return result[0];
}

async function getAllGuestAndInvitationRelated() {
    const result = await pool.query(`
        SELECT 
            g.id AS guest_id,
            g.event_id AS event_id,
            g.full_name,
            g.email,
            g.phone_number,
            g.notification_mode,
            g.rsvp_status,
            g.has_plus_one,
            g.plus_one_name,
            g.dietary_restrictions,
            g.plus_one_name_diet_restr,
            g.notes,
            g.updated_at AS response_date,
            i.id AS invitation_id,
            i.token,
            i.qr_code_url,
            i.created_at AS invitation_sent_date
        FROM GUESTS g
        LEFT JOIN INVITATIONS i ON i.guest_id=g.id
        GROUP BY g.id
    `
    );
    return result[0];
};

async function getAllGuestAndInvitationRelatedByEventId(eventId) {
    const result = await pool.query(`
        SELECT 
            g.id AS guest_id,
            g.event_id AS event_id,
            g.full_name,
            g.email,
            g.phone_number,
            g.notification_mode,
            g.table_number,
            g.rsvp_status,
            g.has_plus_one,
            g.plus_one_name,
            g.dietary_restrictions,
            g.plus_one_name_diet_restr,
            g.notes,
            g.updated_at AS response_date,
            i.id AS invitation_id,
            i.token,
            i.qr_code_url,
            i.created_at AS invitation_sent_date
        FROM GUESTS g
        LEFT JOIN INVITATIONS i ON i.guest_id=g.id
        WHERE g.event_id=?
        ORDER BY g.id
    `,[eventId]
    );
    return result[0];
}

async function getGuestAndInvitationRelatedById(guestId) {
    const [rows] = await pool.execute(`
        SELECT 
            g.id AS guest_id,
            g.full_name,
            g.email,
            g.table_number,
            g.phone_number,
            g.rsvp_status,
            g.guest_has_plus_one_autorise_by_admin,
            g.has_plus_one,
            g.plus_one_name,
            g.dietary_restrictions,
            g.plus_one_name_diet_restr,
            g.notes,
            g.updated_at AS response_date,
            g.notification_mode,

            e.id AS eventId,
            e.title AS eventTitle,
            e.description,
            e.has_plus_one AS eventHasPlusOne,
            e.event_date AS eventDate,
            e.banquet_time AS banquetTime,
            e.event_civil_location AS eventCivilLocation,
            e.religious_location AS religiousLocation,
            e.religious_time AS religiousTime,
            e.show_wedding_religious_location AS showWeddingReligiousLocation,
            e.event_location AS eventLocation,
            e.has_plus_one AS eventHasPlusOne,
            e.foot_restriction AS eventFootRestriction,
            e.type,
            e.event_name_concerned1,
            e.event_name_concerned2,
            e.max_guests,

            i.id AS invitationId,
            i.token AS invitationToken,
            i.qr_code_url AS qrCodeUrl,
            i.created_at AS invitationSentDate
        FROM GUESTS g
        LEFT JOIN EVENTS e ON e.id = g.event_id
        LEFT JOIN INVITATIONS i ON i.guest_id = g.id
        WHERE g.id = ?
        ORDER BY i.created_at DESC
        LIMIT 1
    `, [guestId ?? null]);

    return rows[0] || null;
}

async function update_guest(guestId, eventId, fullName, tableNumber, email, phoneNumber, 
    notificationMode, rsvpStatus, hasPlusOne, guesthasPlusOneAutoriseByAdmin, 
    plusOneName, notes, dietaryRestrictions, plusOneNameDietRestr, updateDate) {
    await pool.query(`UPDATE GUESTS 
                      SET event_id=?, full_name=?, table_number=?, email=?, phone_number=?, notification_mode=?, 
                          rsvp_status=?, has_plus_one=?,guest_has_plus_one_autorise_by_admin=?, plus_one_name=?, 
                          notes=?, dietary_restrictions=?, plus_one_name_diet_restr=?, updated_at=? 
                      WHERE id=?`, 
        [eventId, fullName, tableNumber, email, phoneNumber, notificationMode, rsvpStatus, hasPlusOne, guesthasPlusOneAutoriseByAdmin, plusOneName, notes, 
            dietaryRestrictions, plusOneNameDietRestr, updateDate, guestId]
    );
}

async function updateRsvpStatusGuest(guestId, rsvpStatus) {
    await pool.query(`UPDATE GUESTS SET rsvp_status=? WHERE id=?`, [rsvpStatus, guestId]);
}

async function delete_guest(guestId) {
    await pool.execute(`DELETE FROM GUESTS WHERE id=?`, [guestId]);
}

module.exports = {initGuestModel, createGuest, getGuestById,getGuestByEmail,
    getGuestByEventId, update_guest, updateRsvpStatusGuest, delete_guest,
    getEventByGuestId, getAllGuestAndInvitationRelated,getGuestAndEventRelatedById,
    getAllGuestAndInvitationRelatedByEventId, getGuestAndInvitationRelatedById,
    getGuestByEventIdAndConfirmedRsvp, getAllPresentGuest, createGuestFromLink,
    getAllConfirmedGuests
}