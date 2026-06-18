const pool = require('../config/bd');

const initFeedbacksModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS FEEDBACKS (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        category ENUM('feature','design','performance','support','other') NOT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        email VARCHAR(150) NOT NULL,
        status ENUM('pending','reviewed','resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
  `);
  console.log('✅ Table FEEDBACKS prête !');
};

async function createFeedback(rating, category, title, message, email){
  const [result] = await pool.execute(
    `INSERT INTO FEEDBACKS 
     (rating, category, title, message, email)
     VALUES (?, ?, ?, ?, ?)`,
    [rating, category, title, message, email]
  );

  return result;
};

async function getFeedbackStats() {
  // Stats globales
  const [[stats]] = await pool.query(`
    SELECT 
      COUNT(*) AS totalFeedback,
      ROUND(AVG(rating), 1) AS averageRating
    FROM FEEDBACKS
  `);

  // Distribution des notes
  const [ratings] = await pool.query(`
    SELECT rating, COUNT(*) AS count
    FROM FEEDBACKS
    GROUP BY rating
  `);

  // Distribution par catégorie
  const [categories] = await pool.query(`
    SELECT category, COUNT(*) AS count
    FROM FEEDBACKS
    GROUP BY category
  `);

  return {
    totalFeedback: stats.totalFeedback,
    averageRating: stats.averageRating,
    ratingDistribution: Object.fromEntries(
      ratings.map(r => [r.rating, r.count])
    ),
    categoryDistribution: Object.fromEntries(
      categories.map(c => [c.category, c.count])
    )
  };
}

async function getRecentFeedback() {
  const [rows] = await pool.execute(
    `SELECT *
     FROM FEEDBACKS
     ORDER BY created_at DESC
     LIMIT 5`
  );

  return rows;
}

async function updateStatusFeedback(id, status) {
  const [result] = await pool.query(`
    UPDATE FEEDBACKS 
    SET status=?
    WHERE id=?
  `, [status, id]);

  return result.insertId;
}

async function updateFeedback(id, rating, category, title, message, email) {
  const [result] = await pool.query(`
    UPDATE FEEDBACKS 
    SET rating=?, category=?, title=?, message=?, email=?
    WHERE id=?
  `, [rating, category, title, message, email, id]);

  return result.insertId;
}

module.exports = {
    initFeedbacksModel,
    createFeedback,
    getFeedbackStats,
    getRecentFeedback,
    updateStatusFeedback
};