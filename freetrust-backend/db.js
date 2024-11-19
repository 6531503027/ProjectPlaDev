const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'neuf2545',
  database: 'freetrust',
  connectionLimit: 10, // กำหนดจำนวนสูงสุดของ Connection
});


module.exports = pool.promise();
