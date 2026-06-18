require('dotenv').config();
const pool = require('../config/bd');

// Initialisation du modèle User
const initUserNewsModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS USERNEWS (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20),
      newsletter BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  console.log('✅ Table USERNEWS prête !');
};

async function createUserNews(name, email, phone, newsletter) {
  const [result] = await pool.query(
    `INSERT INTO USERNEWS (name, email, phone, newsletter) VALUES (?, ?, ?, ?)`,
    [name, email, phone, newsletter]
  );
  return result.insertId;
}

async function getUserNewsByEmail(email) {
  const [rows] = await pool.query(`SELECT * FROM USERNEWS WHERE email = ?`, [email]);
  return rows.length ? rows[0] : null;
}

async function updateUserNews(usernewId, name, email, phone, newsletter) {
    const result = await pool.query(`
      UPDATE USERNEWS SET name=?, email=?, phone=?, newsletter=?
      WHERE id=?
  `, [name, email, phone, newsletter, usernewId]);
}

module.exports = {initUserNewsModel, createUserNews, getUserNewsByEmail, updateUserNews}