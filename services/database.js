const { Pool } = require("pg");
require("dotenv").config();

// PostgreSQL connection config
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon/Supabase/Render
  }
});

/**
 * Initialize Database Tables
 */
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Users table for registration
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE,
        username TEXT,
        full_name TEXT,
        phone_number TEXT,
        course TEXT,
        preferred_days TEXT,
        preferred_time TEXT,
        language TEXT DEFAULT 'uz',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Try to add new columns to existing table
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'uz'");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_days TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_time TEXT");

    // IELTS Registrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ielts_registrations (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT,
        full_name TEXT,
        phone_number TEXT,
        gmail TEXT,
        passport_file_id TEXT,
        exam_type TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Try to add the column if it doesn't exist in an older table
    await client.query("ALTER TABLE ielts_registrations ADD COLUMN IF NOT EXISTS exam_type TEXT");

    await client.query("COMMIT");
    console.log("✅ PostgreSQL Database initialized");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Database init error:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Register user for IELTS
 */
async function registerIELTS(data) {
  const { telegramId, fullName, phoneNumber, gmail, passportFileId, examType } = data;
  const query = `
    INSERT INTO ielts_registrations (telegram_id, full_name, phone_number, gmail, passport_file_id, exam_type)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const res = await pool.query(query, [telegramId, fullName, phoneNumber, gmail, passportFileId, examType]);
  return res.rows[0].id;
}

/**
 * Get all IELTS registrations
 */
async function getAllIELTSRegistrations() {
  const res = await pool.query("SELECT * FROM ielts_registrations ORDER BY created_at DESC");
  return res.rows;
}

/**
 * Update IELTS registration status
 */
async function updateIELTSStatus(id, status) {
  await pool.query("UPDATE ielts_registrations SET status = $1 WHERE id = $2", [status, id]);
}

/**
 * Register or update user info
 */
async function registerUser(telegramId, userData) {
  const { username, fullName, phoneNumber, course, preferredDays, preferredTime, language } = userData;
  const query = `
    INSERT INTO users (telegram_id, username, full_name, phone_number, course, preferred_days, preferred_time, language)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'uz'))
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      phone_number = EXCLUDED.phone_number,
      course = EXCLUDED.course,
      preferred_days = EXCLUDED.preferred_days,
      preferred_time = EXCLUDED.preferred_time,
      language = COALESCE(EXCLUDED.language, users.language),
      status = 'pending',
      created_at = CURRENT_TIMESTAMP
    RETURNING id
  `;
  const res = await pool.query(query, [telegramId, username, fullName, phoneNumber, course, preferredDays, preferredTime, language]);
  return res.rows[0].id;
}

/**
 * Update User Language
 */
async function updateUserLanguage(telegramId, language) {
  const query = `
    INSERT INTO users (telegram_id, language)
    VALUES ($1, $2)
    ON CONFLICT (telegram_id) DO UPDATE SET language = EXCLUDED.language
  `;
  await pool.query(query, [telegramId, language]);
}

/**
 * Get user by Telegram ID
 */
async function getUser(telegramId) {
  const res = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [telegramId]);
  return res.rows[0];
}

/**
 * List all registered users (for admin)
 */
async function getAllUsers() {
  const res = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
  return res.rows;
}

/**
 * Update user information
 */
async function updateUser(id, userData) {
  const { full_name, phone_number, course, status } = userData;
  const query = `
    UPDATE users 
    SET full_name = $1, phone_number = $2, course = $3, status = $4
    WHERE id = $5
  `;
  await pool.query(query, [full_name, phone_number, course, status, id]);
}

/**
 * Delete user
 */
async function deleteUser(id) {
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = {
  initDb,
  registerUser,
  getUser,
  getAllUsers,
  updateUser,
  deleteUser,
  registerIELTS,
  getAllIELTSRegistrations,
  updateIELTSStatus,
  updateUserLanguage
};

