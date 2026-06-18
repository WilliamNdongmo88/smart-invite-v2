const pool = require('../config/bd');

const initVisitorModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS VISITORS (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      visitor_id    VARCHAR(64)  NOT NULL UNIQUE,
      ip_address    VARCHAR(45)  DEFAULT 'unknown',
      country       VARCHAR(100) DEFAULT 'unknown',
      city          VARCHAR(100) DEFAULT 'unknown',
      region        VARCHAR(100) DEFAULT 'unknown',
      timezone      VARCHAR(100) DEFAULT 'unknown',
      language      VARCHAR(50)  DEFAULT 'unknown',
      device        VARCHAR(50)  DEFAULT 'unknown',
      os            VARCHAR(100) DEFAULT 'unknown',
      browser       VARCHAR(100) DEFAULT 'unknown',
      first_visit   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_visit    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      total_visits  INT UNSIGNED NOT NULL DEFAULT 1,
      total_pages   INT UNSIGNED NOT NULL DEFAULT 0,
      is_returning  BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS VISITOR_SESSIONS (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      visitor_id  VARCHAR(64)  NOT NULL,
      session_id  VARCHAR(64)  NOT NULL UNIQUE,
      start_time  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      end_time    TIMESTAMP    NULL,
      duration    INT UNSIGNED NOT NULL DEFAULT 0,
      pages_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (visitor_id) REFERENCES VISITORS(visitor_id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS VISITOR_PAGE_VIEWS (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64)  NOT NULL,
      page_url   VARCHAR(500) NOT NULL,
      referrer   VARCHAR(500) DEFAULT '',
      visit_time TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES VISITOR_SESSIONS(session_id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Tables VISITORS, VISITOR_SESSIONS, VISITOR_PAGE_VIEWS prêtes !');
};

// ── Démarrage de session ──────────────────────────────────────────────────────

async function startSession({ visitorId, sessionId, ipAddress, country, city, region, timezone, language, device, os, browser, isReturning }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(`SELECT id FROM VISITORS WHERE visitor_id = ?`, [visitorId]);

    if (existing.length > 0) {
      await conn.query(
        `UPDATE VISITORS SET ip_address=?, country=?, city=?, region=?, timezone=?, language=?,
         device=?, os=?, browser=?, last_visit=NOW(), total_visits=total_visits+1, is_returning=TRUE
         WHERE visitor_id=?`,
        [ipAddress, country, city, region, timezone, language, device, os, browser, visitorId]
      );
    } else {
      await conn.query(
        `INSERT INTO VISITORS (visitor_id, ip_address, country, city, region, timezone, language, device, os, browser, is_returning)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [visitorId, ipAddress, country, city, region, timezone, language, device, os, browser, isReturning]
      );
    }

    await conn.query(
      `INSERT IGNORE INTO VISITOR_SESSIONS (visitor_id, session_id) VALUES (?,?)`,
      [visitorId, sessionId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Page vue ─────────────────────────────────────────────────────────────────

async function recordPageView(sessionId, pageUrl, referrer) {
  const [session] = await pool.query(`SELECT id FROM VISITOR_SESSIONS WHERE session_id=? LIMIT 1`, [sessionId]);
  if (!session.length) return false;

  await pool.query(
    `INSERT INTO VISITOR_PAGE_VIEWS (session_id, page_url, referrer) VALUES (?,?,?)`,
    [sessionId, pageUrl, referrer || '']
  );
  await pool.query(
    `UPDATE VISITOR_SESSIONS SET pages_count=pages_count+1 WHERE session_id=?`,
    [sessionId]
  );
  // Mettre à jour total_pages sur le visiteur
  await pool.query(
    `UPDATE VISITORS v
     JOIN VISITOR_SESSIONS s ON s.visitor_id = v.visitor_id
     SET v.total_pages = v.total_pages + 1
     WHERE s.session_id = ?`,
    [sessionId]
  );
}

// ── Fin de session ────────────────────────────────────────────────────────────

async function endSession(sessionId, duration) {
  await pool.query(
    `UPDATE VISITOR_SESSIONS SET end_time=NOW(), duration=? WHERE session_id=?`,
    [duration || 0, sessionId]
  );
}

// ── Vérifier si visitor_id existe ────────────────────────────────────────────

async function visitorExists(visitorId) {
  const [rows] = await pool.query(`SELECT id FROM VISITORS WHERE visitor_id=? LIMIT 1`, [visitorId]);
  return rows.length > 0;
}

// ── Admin : liste visiteurs ───────────────────────────────────────────────────

async function getAllVisitors({ search, country, city, device, browser, dateFrom, dateTo } = {}) {
  let q = `
    SELECT v.*, s.session_id, s.start_time, s.end_time, s.duration, s.pages_count AS session_pages,
           s.created_at AS session_date
    FROM VISITORS v
    LEFT JOIN VISITOR_SESSIONS s ON s.visitor_id = v.visitor_id
    WHERE 1=1`;
  const p = [];

  if (search) {
    q += ` AND (v.ip_address LIKE ? OR v.country LIKE ? OR v.city LIKE ? OR v.browser LIKE ?)`;
    const like = `%${search}%`;
    p.push(like, like, like, like);
  }
  if (country) { q += ` AND v.country = ?`; p.push(country); }
  if (city)    { q += ` AND v.city = ?`;    p.push(city); }
  if (device)  { q += ` AND v.device = ?`;  p.push(device); }
  if (browser) { q += ` AND v.browser = ?`; p.push(browser); }
  if (dateFrom){ q += ` AND v.first_visit >= ?`; p.push(dateFrom); }
  if (dateTo)  { q += ` AND v.first_visit <= ?`; p.push(dateTo + ' 23:59:59'); }

  q += ` ORDER BY v.last_visit DESC`;
  const [rows] = await pool.query(q, p);
  return rows;
}

// ── Admin : détail d'un visiteur ─────────────────────────────────────────────

async function getVisitorDetail(visitorId) {
  const [visitor] = await pool.query(`SELECT * FROM VISITORS WHERE visitor_id=?`, [visitorId]);
  const [sessions] = await pool.query(
    `SELECT * FROM VISITOR_SESSIONS WHERE visitor_id=? ORDER BY start_time DESC`,
    [visitorId]
  );
  const [pageViews] = await pool.query(
    `SELECT pv.* FROM VISITOR_PAGE_VIEWS pv
     JOIN VISITOR_SESSIONS s ON s.session_id = pv.session_id
     WHERE s.visitor_id=? ORDER BY pv.visit_time DESC`,
    [visitorId]
  );
  return { visitor: visitor[0] || null, sessions, pageViews };
}

// ── Admin : statistiques ──────────────────────────────────────────────────────

async function getVisitorStats() {
  const [[{ total_visitors }]] = await pool.query(`SELECT COUNT(*) AS total_visitors FROM VISITORS`);
  const [[{ total_sessions }]] = await pool.query(`SELECT COUNT(*) AS total_sessions FROM VISITOR_SESSIONS`);
  const [[{ total_pages }]]    = await pool.query(`SELECT COUNT(*) AS total_pages FROM VISITOR_PAGE_VIEWS`);
  const [[{ avg_duration }]]   = await pool.query(`SELECT ROUND(AVG(duration)) AS avg_duration FROM VISITOR_SESSIONS WHERE duration > 0`);
  const [[{ returning_count }]]= await pool.query(`SELECT COUNT(*) AS returning_count FROM VISITORS WHERE is_returning=TRUE`);

  const [byCountry] = await pool.query(
    `SELECT country, COUNT(*) AS count FROM VISITORS GROUP BY country ORDER BY count DESC LIMIT 10`
  );
  const [byCity] = await pool.query(
    `SELECT city, COUNT(*) AS count FROM VISITORS GROUP BY city ORDER BY count DESC LIMIT 10`
  );
  const [byBrowser] = await pool.query(
    `SELECT browser, COUNT(*) AS count FROM VISITORS GROUP BY browser ORDER BY count DESC`
  );
  const [byOS] = await pool.query(
    `SELECT os, COUNT(*) AS count FROM VISITORS GROUP BY os ORDER BY count DESC`
  );
  const [byDevice] = await pool.query(
    `SELECT device, COUNT(*) AS count FROM VISITORS GROUP BY device ORDER BY count DESC`
  );
  const [byDay] = await pool.query(
    `SELECT DATE(start_time) AS day, COUNT(*) AS count FROM VISITOR_SESSIONS
     WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY day ORDER BY day ASC`
  );
  const [byWeek] = await pool.query(
    `SELECT YEARWEEK(start_time, 1) AS week, COUNT(*) AS count FROM VISITOR_SESSIONS
     WHERE start_time >= DATE_SUB(NOW(), INTERVAL 12 WEEK) GROUP BY week ORDER BY week ASC`
  );
  const [byMonth] = await pool.query(
    `SELECT DATE_FORMAT(start_time,'%Y-%m') AS month, COUNT(*) AS count FROM VISITOR_SESSIONS
     WHERE start_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY month ORDER BY month ASC`
  );
  const [topPages] = await pool.query(
    `SELECT page_url, COUNT(*) AS count FROM VISITOR_PAGE_VIEWS GROUP BY page_url ORDER BY count DESC LIMIT 10`
  );

  const returning_rate = total_visitors > 0 ? Math.round((returning_count / total_visitors) * 100) : 0;

  return {
    total_visitors, total_sessions, total_pages, avg_duration, returning_count, returning_rate,
    byCountry, byCity, byBrowser, byOS, byDevice, byDay, byWeek, byMonth, topPages
  };
}

// ── Stats publiques ───────────────────────────────────────────────────────────

async function getPublicVisitorStats() {
  const [[{ total_visitors }]] = await pool.query(`SELECT COUNT(*) AS total_visitors FROM VISITORS`);
  const [[{ total_users }]]    = await pool.query(`SELECT COUNT(*) AS total_users FROM USERS WHERE role='user' AND is_active=TRUE`);
  return { total_visitors, total_users };
}

module.exports = {
  initVisitorModel,
  startSession,
  recordPageView,
  endSession,
  visitorExists,
  getAllVisitors,
  getVisitorDetail,
  getVisitorStats,
  getPublicVisitorStats
};
