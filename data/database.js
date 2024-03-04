import mysql from 'mysql2/promise';

const config = {
  host: 'd115838.mysql.zonevs.eu',
  user: 'd115838_volugram',
  password: 'Kartul12321',
  database: 'd115838_volugram',
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