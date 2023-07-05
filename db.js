const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function authenticate(telegramId) {
  const client = await pool.connect();
  try {
    const user = await client.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return user.rows[0];
  } catch (err) {
    console.log(err.message);
  } finally {
    client.release();
  }
};

async function updateContext(telegramId, messages) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE users SET messages = COALESCE(messages, \'[]\') || $2::jsonb WHERE telegram_id = $1 RETURNING messages',
      [telegramId, JSON.stringify(messages)]);
    let updatedMessages = result.rows[0].messages;
    
    if (updatedMessages.length > 16) {
      updatedMessages = updatedMessages.slice(Math.floor(updatedMessages.length / 2));
      await client.query(
        'UPDATE users SET messages = $2::jsonb WHERE telegram_id = $1',
        [telegramId, JSON.stringify(updatedMessages)]
      );
    }

    if (updatedMessages.some(message => message.content === undefined)) {
      updatedMessages = updatedMessages.filter(message => message.content !== undefined);
      await client.query(
        'UPDATE users SET messages = $2::jsonb WHERE telegram_id = $1',
        [telegramId, JSON.stringify(updatedMessages)]
      );
    }

    return updatedMessages;
  } catch (err) {
    console.log(err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  authenticate,
  updateContext,
}