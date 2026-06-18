const pool = require('../config/bd');

const initLinkModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS LINKS (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      event_id INT UNSIGNED NOT NULL,
      type VARCHAR(255),
      token VARCHAR(255),
      used_count INT NOT NULL DEFAULT 0,
      limit_count INT NOT NULL,
      link VARCHAR(500),
      date_limit_link DATE NULL,
      FOREIGN KEY (event_id) REFERENCES EVENTS(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Table LINKS prête !');
};

async function createLink(eventId, type, token, limitCount, link, dateLimitLink) {
  const [result] = await pool.query(`
      INSERT INTO LINKS (event_id, type, token, limit_count, link, date_limit_link)
      VALUES(?,?,?,?,?,?)
  `,[eventId, type, token, limitCount, link, dateLimitLink]);

  return result;
}

async function getAllLinks() {
  const [result] = await pool.query(`SELECT * FROM LINKS`);

  return result;
}

async function getLinkById(linkId) {
  const [result] = await pool.query(`
      SELECT *
      FROM LINKS
      WHERE id=?
  `,[linkId]);

  return result[0];
}

async function getUserRoleByToken(token) {
  const [rows] = await pool.query(
    `
    SELECT
        l.id AS linkId,
        l.type AS linkType,

        e.id AS eventId,

        u.id AS organizerId,
        u.role AS organizerRole,
        u.email AS organizerEmail
    FROM LINKS l
    LEFT JOIN EVENTS e ON e.id = l.event_id
    LEFT JOIN USERS  u ON u.id = e.organizer_id
    WHERE l.token = ?
    LIMIT 1
    `,
    [token]
  );
  return rows.length ? rows[0] : null;
}

async function getLinkByToken(token) {
  const [result] = await pool.query(`
      SELECT *
      FROM LINKS
      WHERE token=?
  `,[token]);

  return result[0];
}

async function updateLink(linkId, usedCount, type, usedLimitCount, dateLimitLink) {
  const [result] = await pool.query(`
    UPDATE LINKS 
    SET used_count=?, type=?, limit_count=?, date_limit_link=?
    WHERE id=?
  `, [usedCount, type, usedLimitCount, dateLimitLink, linkId]);

  return result.insertId;
}

async function updateLinkUsedCount(linkId, action = 'increment') {

    let query = '';
    if (action === 'increment') {
        query = `
            UPDATE LINKS
            SET used_count = used_count + 1
            WHERE id = ?
            AND used_count < limit_count
        `;
    } else if (action === 'decrement') {
        query = `
            UPDATE LINKS
            SET used_count = used_count - 1
            WHERE id = ?
            AND used_count > 0
        `;
    } else {
        throw new Error('Action invalide');
    }
    const [result] = await pool.query(
        query,
        [linkId]
    );

    return result.affectedRows > 0;
}

async function deleteLink(linkId) {
    await pool.query(`DELETE FROM LINKS WHERE id=?`, [linkId]);
}

module.exports = {
  initLinkModel, createLink, 
  getAllLinks, getLinkById, getLinkByToken,
  updateLink, updateLinkUsedCount,
  deleteLink, getUserRoleByToken
}