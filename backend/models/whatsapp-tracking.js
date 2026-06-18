require('dotenv').config();
const pool = require('../config/bd');

const initWhatsappTrackingModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS WHATSAPP_TRACKING (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        whatsapp_message_id VARCHAR(255) NOT NULL UNIQUE,
        event_id INT UNSIGNED NOT NULL,
        guest_id INT UNSIGNED NOT NULL,
        invitation_id INT UNSIGNED NOT NULL,
        chat_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE,
        FOREIGN KEY (guest_id) REFERENCES GUESTS(id) ON DELETE CASCADE,

        INDEX idx_whatsapp_message_id (whatsapp_message_id),
        INDEX idx_chat_id (chat_id),
        INDEX idx_event_id (event_id)
    )
  `);
  console.log('✅ Table WHATSAPP_TRACKING prête !');
};

const saveWhatsappTracking = async (whatsappMessageId, eventId, guestId, invitationId, chatId) => {

    const sql = `
        INSERT INTO WHATSAPP_TRACKING
        (
            whatsapp_message_id,
            event_id,
            guest_id,
            invitation_id,
            chat_id
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [ whatsappMessageId, eventId, guestId, invitationId, chatId ]);

    return result.insertId;
};

const findTrackingByMessageId = async ( whatsappMessageId ) => {

    const sql = `
        SELECT *
        FROM WHATSAPP_TRACKING
        WHERE whatsapp_message_id = ?
        LIMIT 1
    `;

    const [rows] = await pool.execute(
        sql,
        [whatsappMessageId]
    );

    return rows[0] || null;
};

const findLatestTrackingByChatId = async (chatId) => {

    const sql = `
        SELECT *
        FROM WHATSAPP_TRACKING
        WHERE chat_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `;

    const [rows] = await db.execute(sql, [chatId]);

    return rows[0] || null;
};

module.exports = {
    initWhatsappTrackingModel,
    saveWhatsappTracking,
    findTrackingByMessageId,
    findLatestTrackingByChatId
};