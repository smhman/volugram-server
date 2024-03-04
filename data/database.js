import mysql from 'mysql2/promise';

const config = {
  host: '',
  user: '',
  password: '',
  database: '',
  waitForConnections: true,
  connectionLimit: 0, // This will cause preflight requests to fail if set under a limit of 10 or so
  queueLimit: 0,
};

const pool = mysql.createPool(config);

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database');

    connection.release();
  } catch (error) {
    console.error('Error connecting to database:', error);
  }
})();

export default pool;