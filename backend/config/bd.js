const mysql = require('mysql2/promise');
require('dotenv').config({
  path: process.env.NODE_ENV === 'test'
    ? '.env.test'
    : '.env'
});

const ENVIRONMENT = process.env.NODE_ENV;
console.log('ENVIRONMENT:', ENVIRONMENT);
let pool=null;
if(ENVIRONMENT=='development') pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3308,
  user: process.env.MYSQL_USER|| 'root',
  password: process.env.MYSQL_PASSWORD|| 'dev-root',
  database: process.env.MYSQL_DATABASE || 'dev_smart_invite_db',
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: "utf8mb4",
  timezone: 'Z',
});

// ✅ NE PAS lancer pendant Jest
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await pool.query('SELECT 1');
      console.log('✅ MySQL keepalive OK');
    } catch (err) {
      console.error('❌ MySQL keepalive error:', err.message);
    }
  }, 240000);
}

if(ENVIRONMENT=='production') pool = mysql.createPool({
  host: process.env.MYSQLHOST || 'localhost',
  port: process.env.MYSQLPORT || 3308,
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'dev-root',
  database: process.env.MYSQLDATABASE || 'dev_smart_invite_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: 'Z',
});

if(ENVIRONMENT=='test') pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3308,
  user: process.env.MYSQL_USER|| 'root',
  password: process.env.MYSQL_PASSWORD|| 'dev-root',
  database: process.env.MYSQL_DATABASE || 'test_smart_invite_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: 'Z',
});

if(ENVIRONMENT=='development') console.log("📌 Connected to DB:", process.env.MYSQL_DATABASE);
if(ENVIRONMENT=='production') console.log("📌 Connected to DB:", process.env.MYSQLDATABASE);
if(ENVIRONMENT=='test') console.log("📌 Connected to DB:", process.env.MYSQL_DATABASE);
console.log('✅ Pool MySQL initialisé.');

module.exports = pool;
