const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config(); // ใช้สำหรับการดึงค่าจาก .env

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Config สำหรับการส่งอีเมล
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // อีเมลของคุณใน .env
    pass: process.env.EMAIL_PASS, // รหัสผ่านใน .env
  },
});

// -------------------- USERS APIs --------------------

// Signup API
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [
      username,
      email,
      hashedPassword,
    ]);

    res.json({ success: true, message: 'User created successfully!' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Login API
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    res.json({ success: true, message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Forgot Password API
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const [user] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'Email not found!' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.query('INSERT INTO password_resets (email, token) VALUES (?, ?)', [email, token]);

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    await transporter.sendMail({
      from: `"Support Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click the link below to reset your password:</p><a href="${resetLink}">${resetLink}</a>`,
    });

    res.json({ success: true, message: 'Password reset link sent!' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Reset Password API
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;

  try {
    const [rows] = await db.query('SELECT email FROM password_resets WHERE token = ?', [token]);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token!' });
    }

    const email = rows[0].email;
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    await db.query('DELETE FROM password_resets WHERE token = ?', [token]);

    res.json({ success: true, message: 'Password reset successful!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// -------------------- JOBS APIs --------------------

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM jobs');
    res.json({ success: true, jobs: rows });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Get job by ID
app.get('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;

  try {
    const [rows] = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found!' });
    }
    res.json({ success: true, job: rows[0] });
  } catch (err) {
    console.error('Get job error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Create a job
app.post('/api/jobs', async (req, res) => {
  const { title, category, jobCategory, salary, property, benefits, location } = req.body;

  if (!title || !category) {
    return res.status(400).json({ success: false, message: 'Title and category are required.' });
  }

  try {
    await db.query(
      'INSERT INTO jobs (title, category, jobCategory, salary, property, benefits, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, category, jobCategory, salary, property, benefits, location]
    );

    res.json({ success: true, message: 'Job created successfully!' });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Update a job
app.put('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;
  const { title, category, jobCategory, salary, property, benefits, location } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE jobs SET title = ?, category = ?, jobCategory = ?, salary = ?, property = ?, benefits = ?, location = ? WHERE id = ?',
      [title, category, jobCategory, salary, property, benefits, location, jobId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Job not found!' });
    }

    res.json({ success: true, message: 'Job updated successfully!' });
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});

// Delete a job
app.delete('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;

  try {
    const [result] = await db.query('DELETE FROM jobs WHERE id = ?', [jobId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Job not found!' });
    }

    res.json({ success: true, message: 'Job deleted successfully!' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});
app.get('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;
  try {
    const [rows] = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found!' });
    }
    res.json({ success: true, job: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'An error occurred.' });
  }
});
app.get('/api/jobs', async (req, res) => {
  const { page = 1, limit = 10 } = req.query; // รับค่า page และ limit
  const offset = (page - 1) * limit;

  try {
    const [rows] = await db.query('SELECT * FROM jobs LIMIT ? OFFSET ?', [Number(limit), offset]);
    res.json({ success: true, jobs: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching data' });
  }
});

// -------------------- START SERVER --------------------

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
