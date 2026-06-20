require('dotenv').config();
const pool = require('../config/bd');

const initEventsModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS EVENTS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organizer_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50),    -- New field: type
        budget VARCHAR(50),  -- New field: budget
        event_name_concerned1 VARCHAR(50), -- New field: event_name_concerned1
        event_name_concerned2 VARCHAR(50), -- New field: event_name_concerned2
        event_date TIMESTAMP NOT NULL,
        banquet_time TIME NULL,
        religious_location VARCHAR(255),
        religious_time TIME NULL,
        event_civil_location VARCHAR(255),
        event_location VARCHAR(255),
        max_guests INTEGER,
        has_plus_one BOOLEAN NOT NULL DEFAULT FALSE,
        foot_restriction BOOLEAN NOT NULL DEFAULT FALSE,
        show_wedding_religious_location BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organizer_id) REFERENCES USERS(id) ON DELETE CASCADE,
        CONSTRAINT valid_status CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'))
    )
  `);
  console.log('✅ Table EVENTS prête !');
};

async function createEvent(organizerId, title, description, eventDate, banquetTime, religiousLocation, 
                            religiousTime, type, budget, eventNameConcerned1,eventNameConcerned2, 
                            eventCivilLocation, eventLocation, maxGuests,hasPlusOne, 
                            footRestriction, showWeddingReligiousLocation, status) {
    const [result] = await pool.execute(`INSERT INTO EVENTS (organizer_id, title, description, 
                                            event_date, banquet_time, religious_location, religious_time,
                                            event_civil_location, event_location, max_guests,has_plus_one, 
                                            foot_restriction, show_wedding_religious_location, status, type, budget, 
                                            event_name_concerned1, event_name_concerned2) 
                                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [organizerId, title, description, eventDate, banquetTime, religiousLocation, religiousTime, 
        eventCivilLocation, eventLocation, maxGuests,hasPlusOne, footRestriction, showWeddingReligiousLocation, 
        status, type, budget, eventNameConcerned1, eventNameConcerned2]);
    return result.insertId;
}

async function getEvents() {
    const [event] = await pool.query(`SELECT * FROM EVENTS`);
    return event;
}

async function getEventAndInvitationById(eventId) {
    const result = await pool.query(`
        SELECT
            e.id AS eventId,
            e.title,
            g.id AS guestId,
            g.full_name AS guestName,
            g.has_plus_one AS hasPlusOne,
            g.plus_one_name AS plusOneName,
            i.id AS invitationId,
            i.token
        FROM EVENTS e
        LEFT JOIN GUESTS g ON g.event_id=e.id
        LEFT JOIN INVITATIONS i ON i.guest_id=g.id
        WHERE e.id = ?
        ORDER BY e.id
    `, [eventId]);
    return result[0];
}

async function getEventWithTotalGuest() {
  const [rows] = await pool.query(`
    SELECT
      e.id AS event_id,
      e.title,
      e.description,
      e.event_date,
      e.religious_location,
      e.religious_time,
      e.banquet_time,
      e.event_civil_location,
      e.event_location,
      e.max_guests,
      e.has_plus_one,
      e.foot_restriction,
      e.show_wedding_religious_location,
      e.status,
      e.type,
      e.budget,
      e.event_name_concerned1,
      e.event_name_concerned2,
      COUNT(g.id) AS total_guests,
      SUM(CASE WHEN g.rsvp_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
      SUM(CASE WHEN g.rsvp_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN g.rsvp_status = 'DECLINED' THEN 1 ELSE 0 END) AS declined_count
    FROM EVENTS e
    LEFT JOIN GUESTS g ON g.event_id = e.id
    GROUP BY
      e.id,
      e.title,
      e.description,
      e.event_date,
      e.religious_location,
      e.religious_time,
      e.banquet_time,
      e.event_civil_location,
      e.event_location,
      e.max_guests,
      e.has_plus_one,
      e.foot_restriction,
      e.show_wedding_religious_location,
      e.status,
      e.type,
      e.budget,
      e.event_name_concerned1,
      e.event_name_concerned2
  `);

  return rows;
}

async function getEventById(eventId) {
    const [event] = await pool.query(`SELECT * FROM EVENTS WHERE id = ?`, [eventId]);
    return event[0];
}

async function getGuestEmailRelatedToEvent(email, eventId) {
    const [event] = await pool.query(`
        SELECT 
        e.id AS eventId,
        e.title,
        e.type,
        e.budget,
        e.has_plus_one,
        e.foot_restriction,
        e.event_name_concerned1,
        e.event_name_concerned2,
        g.id AS guestId,
        g.full_name,
        g.email,
        g.phone_number,
        u.id AS organizerId,
        u.role
        FROM EVENTS e
        LEFT JOIN GUESTS g ON g.event_id = e.id
        LEFT JOIN USERS u ON u.id = e.organizer_id
        WHERE g.email = ? AND e.id = ?
        ORDER BY e.id`, [email, eventId]);
    return event[0];
}

async function getGuestPhoneRelatedToEvent(phone, eventId) {
    const [event] = await pool.query(`
        SELECT 
        e.id AS eventId,
        e.title,
        e.type,
        e.budget,
        e.has_plus_one,
        e.foot_restriction,
        e.event_name_concerned1,
        e.event_name_concerned2,
        g.id AS guestId,
        g.full_name,
        g.email,
        g.phone_number,
        u.id AS organizerId,
        u.role
        FROM EVENTS e
        LEFT JOIN GUESTS g ON g.event_id = e.id
        LEFT JOIN USERS u ON u.id = e.organizer_id
        WHERE g.phone_number = ? AND e.id = ?
        ORDER BY e.id`, [phone, eventId]);
    return event[0];
}

async function getEventsByOrganizerId(organizerId) {
    const [event] = await pool.query(`
        SELECT 
            e.id AS event_id,
            e.title,
            e.description,
            e.event_date,
            e.religious_location,
            e.religious_time,
            e.banquet_time,
            e.event_civil_location,
            e.event_location,
            e.max_guests,
            e.has_plus_one,
            e.foot_restriction,
            e.show_wedding_religious_location,
            e.status,
            e.type,
            e.budget,
            e.event_name_concerned1,
            e.event_name_concerned2,
            u.id As organizerId,
            COUNT(g.id) AS total_guests,
            SUM(CASE WHEN g.rsvp_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
            SUM(CASE WHEN g.rsvp_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN g.rsvp_status = 'DECLINED' THEN 1 ELSE 0 END) AS declined_count
        FROM EVENTS e
        LEFT JOIN GUESTS g ON g.event_id = e.id
        LEFT JOIN USERS u ON e.organizer_id = u.id
        WHERE organizer_id = ?
        GROUP BY e.id,
            e.title,
            e.description,
            e.event_date,
            e.religious_location,
            e.religious_time,
            e.banquet_time,
            e.event_civil_location,
            e.event_location,
            e.max_guests,
            e.has_plus_one,
            e.foot_restriction,
            e.show_wedding_religious_location,
            e.status,
            e.type,
            e.budget,
            e.event_name_concerned1,
            e.event_name_concerned2
    `, [organizerId]);
    //console.log("event: ", event);
    return event;
}

async function getEventWithTotalGuestById(eventId) {
    const result = await pool.query(`
        SELECT
            e.id AS event_id,
            e.title,
            e.description,
            e.event_date,
            e.religious_location,
            e.religious_time,
            e.banquet_time,
            e.event_civil_location,
            e.event_location,
            e.max_guests,
            e.status,
            e.created_at,
            e.updated_at,
            e.organizer_id,
            e.foot_restriction,
            e.show_wedding_religious_location,
            e.has_plus_one,
            e.type,
            e.budget,
            e.event_name_concerned1,
            e.event_name_concerned2,
            COUNT(g.id) AS total_guests,
            SUM(CASE WHEN g.rsvp_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
            SUM(CASE WHEN g.rsvp_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN g.rsvp_status = 'DECLINED' THEN 1 ELSE 0 END) AS declined_count,
            u.id AS organizerId,
            u.email AS emailOrganizer
        FROM EVENTS e
        LEFT JOIN GUESTS g ON g.event_id = e.id
        LEFT JOIN USERS u ON u.id=e.organizer_id
        WHERE e.id = ?
        GROUP BY e.id,
            e.title,
            e.description,
            e.event_date,
            e.religious_location,
            e.religious_time,
            e.banquet_time,
            e.event_civil_location,
            e.event_location,
            e.max_guests,
            e.status,
            e.created_at,
            e.updated_at,
            e.organizer_id,
            e.foot_restriction,
            e.show_wedding_religious_location,
            e.has_plus_one,
            e.type,
            e.budget,
            e.event_name_concerned1,
            e.event_name_concerned2,
            u.id,
            u.email
    `, [eventId]
    );
    return result[0];
}

async function updateEvent(eventId, organizerId, title, description, eventDate, banquetTime, 
                           religiousLocation, religiousTime, eventCivilLocation, eventLocation, 
                           maxGuests, hasPlusOne, footRestriction, showWeddingReligiousLocation,
                           status, type, budget, eventNameConcerned1, eventNameConcerned2 ) {

    await pool.query(`UPDATE EVENTS SET organizer_id=?, title=?, description=?, event_date=?, 
            banquet_time=?, religious_location=?, religious_time=?,
            event_civil_location=?, event_location=?, max_guests=?,has_plus_one=?, foot_restriction=?,
            show_wedding_religious_location=?,
            status=?, 
            type=?,
            budget=?,
            event_name_concerned1=?,
            event_name_concerned2=? WHERE id=?`, [organizerId, title, description, eventDate, 
                banquetTime, religiousLocation, religiousTime, eventCivilLocation, eventLocation, 
                maxGuests,hasPlusOne, footRestriction, showWeddingReligiousLocation, status, type, 
                budget, eventNameConcerned1, eventNameConcerned2, eventId]);
}

async function updateEventStatus(eventId, status) {
    await pool.query(`UPDATE EVENTS SET status=? WHERE id=?`, [status, eventId]);
}

async function deleteEvents(eventId) {
    await pool.execute(`DELETE FROM EVENTS WHERE id = ?`, [eventId]);
}

async function getUserByEventId(eventId) {
    const [result] = await pool.query(`
        SELECT
            e.id AS eventId,
            e.title,
            u.id AS organizerId,
            u.name,
            u.email,
            u.phone,
            u.notification_mode,
            u.email_notifications,
            u.attendance_notifications,
            u.thank_notifications,
            u.event_reminders,
            u.marketing_emails
        FROM EVENTS e
        LEFT JOIN USERS u ON u.id=e.organizer_id
        WHERE e.id=?
    `, [eventId]);

    return result[0];
}

async function getUserByEvtId(eventId) {
  const [result] = await pool.query(`
    SELECT
      e.id AS eventId,
      e.title,
      e.max_guests,
      u.id AS organizerId,
      COUNT(g.id) AS total_guests
    FROM EVENTS e
    JOIN USERS u ON u.id = e.organizer_id
    LEFT JOIN GUESTS g ON g.event_id = e.id
    WHERE e.id = ?
    GROUP BY e.id, u.id
  `, [eventId]);

//   //console.log('getUserByEvtId:', result[0]);
  return result[0] || null;
}

module.exports = {
    initEventsModel, createEvent, getEvents, updateEvent,updateEventStatus,
    getEventById, getEventsByOrganizerId,deleteEvents,
    getEventWithTotalGuestById, getEventWithTotalGuest,
    getGuestEmailRelatedToEvent, getGuestPhoneRelatedToEvent,
    getEventAndInvitationById,
    getUserByEventId,getUserByEvtId
};