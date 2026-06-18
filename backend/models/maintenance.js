const pool = require('../config/bd');

const initMaintenanceModel = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS MAINTENANCES (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        maintenance_progress INT DEFAULT 0,
        subscribed BOOLEAN NOT NULL DEFAULT FALSE,
        estimated_time VARCHAR(25),
        email VARCHAR(150),
        status ENUM('enabled','disabled') DEFAULT 'disabled',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        lastUpdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
  `);
  console.log('✅ Table MAINTENANCES prête !');
};

async function createDefaultTableMaintenance() {
  try {
    // 1️⃣ Vérifier s'il existe déjà une ligne de maintenance
    const [rows] = await pool.query(
      `SELECT id FROM MAINTENANCES LIMIT 1`
    );

    if (rows.length > 0) {
      console.log('ℹ️ Table MAINTENANCES déjà initialisée');
      return rows[0].id;
    }

    // 2️⃣ Créer l’entrée par défaut
    const [result] = await pool.query(
      `
        INSERT INTO MAINTENANCES 
        (maintenance_progress, subscribed, estimated_time, email, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        0,            // maintenance_progress
        false,        // subscribed
        null,         // estimated_time
        null,         // email
        'disabled'    // status
      ]
    );

    console.log('✅ Ligne MAINTENANCES par défaut créée');

    return result.insertId;
  } catch (error) {
    console.error('❌ createDefaultTableMaintenance ERROR:', error.message);
    throw error;
  }
}

async function createMaintenance({
    maintenanceProgress = 0, 
    subscribed = false, 
    estimatedTime = null, email = null, status = 'disabled'
}) {
  const [result] = await pool.query(
    `
      INSERT INTO MAINTENANCES 
      (maintenance_progress, subscribed, estimated_time, email, status)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      maintenanceProgress,
      subscribed,
      estimatedTime,
      email,
      status
    ]
  );

  return result.insertId;
}


async function getMaintenanceById(id) {
  const [rows] = await pool.query(
    `SELECT * FROM MAINTENANCES WHERE id = ?`,
    [id]
  );
  return rows[0];
}

async function updateMaintenance(id, maintenanceProgress,subscribed,email,status) {
  const [result] = await pool.query(
    `
    UPDATE MAINTENANCES
    SET
      maintenance_progress = ?,
      subscribed = ?,
      email = ?,
      status = ?,
      lastUpdate = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [maintenanceProgress,subscribed,email,status,id]
  );

  return result.affectedRows > 0;
}

module.exports = {
    initMaintenanceModel,
    createDefaultTableMaintenance,
    createMaintenance,
    getMaintenanceById,
    updateMaintenance
};