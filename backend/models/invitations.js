require('dotenv').config();
const pool = require('../config/bd');

const initInvitationModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS INVITATIONS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guest_id INT UNSIGNED UNIQUE,
        chat_id VARCHAR(50),
        token VARCHAR(255) NOT NULL UNIQUE,
        qr_code_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        is_invitation_sent BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMP,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guest_id) REFERENCES GUESTS(id) ON DELETE CASCADE,
        CONSTRAINT valid_invitation_status CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED'))
    )
  `);
  console.log('✅ Table INVITATIONS prête !');
};

async function createInvitation( guestId, token, qrCodeUrl = null ) {

    const [result] = await pool.execute(
        `
        INSERT INTO INVITATIONS (
            guest_id,
            token,
            qr_code_url
        )
        VALUES (?, ?, ?)
        `,
        [ guestId, token, qrCodeUrl ]
    );

    return result.insertId;
}

async function updateInvitationQrCode( guestId, qrCodeUrl ) {

    const [rows] = await pool.query(
        `
        UPDATE INVITATIONS
        SET qr_code_url = ?
        WHERE guest_id = ?
        `,
        [ qrCodeUrl, guestId ]
    );

    return rows[0];
}
// async function updateInvitationQrCode(invitationId, qrCodeUrl) {
//     console.log('[updateInvitationQrCode] variable:', {invitationId, qrCodeUrl});
//     await pool.execute(
//         `
//         UPDATE INVITATIONS
//         SET qr_code_url = ?
//         WHERE id = ?
//         `,
//         [qrCodeUrl, invitationId]
//     );

//     const [rows] = await pool.execute(
//         `
//         SELECT *
//         FROM INVITATIONS
//         WHERE id = ?
//         `,
//         [invitationId]
//     );

//     return rows[0];
// }

async function updateInvitationByChatId( invitationId, chatId, isInvitationSent = false ) {
    const [result] = await pool.query(
        `
        UPDATE INVITATIONS
        SET chat_id = ?, is_invitation_sent = ?

        WHERE id = ?
        `,
        [ chatId, isInvitationSent, invitationId ]
    );

    return result.affectedRows > 0;
}

async function getInvitationById(invitationId) {
    const result = await pool.query(`SELECT * FROM INVITATIONS WHERE id=?`, [invitationId]);
    return result[0];
};

async function getGuestByInvitationId(invitationId) {
    const [result] = await pool.execute(`
        SELECT 
            i.id AS invitationId,
            i.used_at AS usedAt,
            g.id AS guestId,
            g.full_name AS name,
            g.plus_one_name AS plusOneName,
            g.rsvp_status AS rsvpStatus
        FROM INVITATIONS i
        LEFT JOIN GUESTS g ON g.id=i.guest_id
        WHERE i.id=?
    `,[invitationId]);

    return result[0];
}

async function getGuestInvitationById(guestId) {
    const result = await pool.query(`SELECT * FROM INVITATIONS WHERE guest_id=?`, [guestId]);
    return result[0];
};

async function getGuestInvitationByToken(token) {
    const result = await pool.query(`SELECT * FROM INVITATIONS WHERE token=?`, [token]);
    return result[0];
};

const getInvitationByChatId = async (chatId) => {

    const query = `
        SELECT *
        FROM INVITATIONS
        WHERE chat_id = ?
        LIMIT 1
    `;

    const [rows] = await pool.execute(query, [chatId]);

    return rows[0];
};

async function updateInvitationById(invitationId, status, usedAt) {
    //console.log('variable:', {invitationId, status, usedAt});
    const [result] = await pool.query(`UPDATE INVITATIONS SET status=?, used_at=?, updated_at=? WHERE id=?`,
        [status, usedAt, usedAt, invitationId]
    );
    return result[0];
}

async function deleteGuestInvitation(guestId) {
    await pool.query(`DELETE FROM INVITATIONS WHERE guest_id=?`, [guestId]);
};

module.exports = {
    initInvitationModel, getInvitationById, 
    createInvitation, getGuestByInvitationId, 
    updateInvitationByChatId, getInvitationByChatId,
    getGuestInvitationById, getGuestInvitationByToken, 
    updateInvitationById, updateInvitationQrCode, deleteGuestInvitation
};