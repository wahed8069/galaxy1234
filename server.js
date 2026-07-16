const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JOBS_FILE = path.join(__dirname, 'jobs.json');

// Configure NodeMailer transporter (defaults to Gmail)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: process.env.EMAIL_PORT !== '587', // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER || '', // your sender email (e.g. Gmail address)
    pass: process.env.EMAIL_PASS || ''  // your sender password or App Password
  }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname)); // Serve frontend static assets

// Admin Credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password';
const ADMIN_TOKEN = 'galaxy-ventures-admin-session-token-2026';

// Helper: Read jobs from JSON
function readJobs() {
  try {
    if (!fs.existsSync(JOBS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(JOBS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading jobs file:', err);
    return [];
  }
}

// Helper: Write jobs to JSON
function writeJobs(jobs) {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing jobs file:', err);
    return false;
  }
}

// --- API ROUTES ---

// 1. Authenticate Admin Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      message: 'Admin authenticated successfully.'
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Invalid username or password.'
    });
  }
});

// 2. Fetch Job Database
app.get('/api/jobs', (req, res) => {
  const jobs = readJobs();
  res.json(jobs);
});

// 3. Add Job Posting (Authenticated)
app.post('/api/jobs', (req, res) => {
  // Validate token in Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing administrator token.'
    });
  }
  
  const { title, company, location, salary, type, industry, logo, requirements } = req.body;
  
  if (!title || !company || !location || !salary || !requirements) {
    return res.status(400).json({
      success: false,
      error: 'Missing required job parameters.'
    });
  }
  
  const jobs = readJobs();
  
  // Calculate next ID
  const nextId = jobs.reduce((max, job) => (job.id > max ? job.id : max), 0) + 1;
  
  const newJob = {
    id: nextId,
    title,
    company,
    location,
    salary,
    type: type || 'Full-time',
    industry: industry || 'IT & Technology',
    logo: logo || '🏢',
    requirements
  };
  
  jobs.unshift(newJob); // Put it at the beginning
  
  if (writeJobs(jobs)) {
    res.status(201).json({
      success: true,
      job: newJob
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to write job entry to disk.'
    });
  }
});

// 4. Delete Job Posting (Authenticated)
app.delete('/api/jobs/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing administrator token.'
    });
  }
  
  const jobId = parseInt(req.params.id);
  let jobs = readJobs();
  const initialLength = jobs.length;
  jobs = jobs.filter(j => j.id !== jobId);
  
  if (jobs.length === initialLength) {
    return res.status(404).json({
      success: false,
      error: 'Job posting not found.'
    });
  }
  
  if (writeJobs(jobs)) {
    res.json({
      success: true,
      message: 'Job entry deleted successfully.'
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to write updated jobs list to disk.'
    });
  }
});

// 5. Submit Job Application & Send Auto-Email Dispatch
app.post('/api/apply', async (req, res) => {
  const { name, email, phone, location, jobTitle, experience, company, salary, jobLocation } = req.body;
  
  console.log(`\n--- NEW JOB APPLICATION SUBMITTED ---`);
  console.log(`Candidate Name: ${name}`);
  console.log(`Email Address:  ${email}`);
  console.log(`Phone Number:   ${phone}`);
  console.log(`Location:       ${location}`);
  console.log(`Job Title:      ${jobTitle} at ${company}`);
  console.log(`Experience:     ${experience}`);
  console.log(`-------------------------------------\n`);
  
  const recipientEmail = process.env.EMAIL_TO || 'info.galaxyventureuae@gmail.com';
  const senderEmail = process.env.EMAIL_USER || 'info.galaxyventureuae@gmail.com';

  const mailOptions = {
    from: `"Galaxy Venture Desk" <${senderEmail}>`,
    to: recipientEmail,
    subject: `New Job Application: ${jobTitle} - ${name}`,
    text: `New Job Application Received!\n\nCandidate Details:\n- Name: ${name}\n- Email: ${email}\n- Phone: ${phone}\n- Location: ${location}\n- Experience: ${experience}\n\nJob Details:\n- Title: ${jobTitle}\n- Company: ${company}\n- Salary: ${salary}\n- Location: ${jobLocation}\n\n---\nGalaxy Venture Sourcing System`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">New Job Application</h2>
        <p><strong>Job Title:</strong> ${jobTitle}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Salary Range:</strong> ${salary}</p>
        <p><strong>Job Location:</strong> ${jobLocation}</p>
        
        <h3 style="color: #1e3a8a; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Candidate Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 6px 0;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Email:</td>
            <td style="padding: 6px 0;"><a href="mailto:${email}">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Phone:</td>
            <td style="padding: 6px 0;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Location:</td>
            <td style="padding: 6px 0;">${location}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold;">Experience:</td>
            <td style="padding: 6px 0;">${experience}</td>
          </tr>
        </table>
        <br>
        <p style="font-size: 0.8rem; color: #666; border-top: 1px solid #eee; padding-top: 8px;">This is an automated notification from the Galaxy Venture application system.</p>
      </div>
    `
  };

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log(`Sending application email to ${recipientEmail}...`);
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully!');
    } else {
      console.log('--- SMTP Credentials Missing ---');
      console.log(`Email would be sent to: ${recipientEmail}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Content: \n${mailOptions.text}\n`);
    }

    res.json({
      success: true,
      message: 'Application registered and sent via email successfully.'
    });
  } catch (err) {
    console.error('Error dispatching application email from backend:', err);
    res.json({
      success: true,
      message: 'Application registered (Email server offline).'
    });
  }
});

// Serve main client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` Galaxy Ventures Backend Server Running `);
  console.log(` Port: http://localhost:${PORT}          `);
  console.log(`========================================`);
});
