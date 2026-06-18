const pool = require('../config/bd');

const initNotificationModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS NOTIFICATIONS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_id INT UNSIGNED NOT NULL,
        title VARCHAR(255),
        message TEXT,
        type VARCHAR(255),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Table NOTIFICATIONS prête !');
};

async function createNotification(eventId, title, message, type, isRead) {
    const [result] = await pool.query(`
        INSERT INTO NOTIFICATIONS (event_id, title, message, type, is_read)
        VALUES(?,?,?,?,?)
    `,[eventId, title, message, type, isRead]);

    return result.insertId;
}

async function getNotifications() {
  const [result] = await pool.query(`
    SELECT 
      n.*,
      u.id AS organizer_id,
      u.name AS organizer_name,
      u.email AS organizer_email
    FROM NOTIFICATIONS n
    JOIN EVENTS e ON n.event_id = e.id
    JOIN USERS u ON e.organizer_id = u.id
    ORDER BY n.date DESC
  `);
  return result ?? null;
}

async function getNotificationById(notifId) {
    const [result] = await pool.query(`SELECT * FROM NOTIFICATIONS WHERE id=?`, [notifId]);
    return result[0] ?? null; // si vide → null
}

async function updateNotif(notificationId, isRead) {
    const [result] = await pool.query(`UPDATE NOTIFICATIONS SET is_read=? WHERE id=?`, [isRead, notificationId]);
    return result[0];
}

async function deleteNotif(notificationId) {
    await pool.query(`DELETE FROM NOTIFICATIONS WHERE id=?`, [notificationId]);
}

async function deleteAllNotif() {
    await pool.query(`DELETE FROM NOTIFICATIONS`);
}

module.exports = {initNotificationModel, createNotification, 
                  getNotifications, updateNotif, deleteNotif,
                  getNotificationById, deleteAllNotif
                }