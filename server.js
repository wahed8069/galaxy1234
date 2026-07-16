const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JOBS_FILE = path.join(__dirname, 'jobs.json');

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

// 5. Submit Job Application & Send Auto-WhatsApp Dispatch (via UltraMsg)
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
  
  const messageText = `Hello, I'd like to apply for the job:\n\n*Job:* ${jobTitle}\n*Company:* ${company}\n*Salary:* ${salary}\n*Location:* ${jobLocation}\n\n*Candidate Details:*\n- *Name:* ${name}\n- *Email:* ${email}\n- *Phone:* ${phone}\n- *Location:* ${location}\n- *Experience:* ${experience}`;

  const instanceId = process.env.ULTRAMSG_INSTANCE_ID || '';
  const token = process.env.ULTRAMSG_TOKEN || '';
  const recipientPhone = process.env.ULTRAMSG_RECIPIENT_PHONE || '918589026612';

  try {
    if (instanceId && token) {
      console.log(`Sending WhatsApp message via UltraMsg (Instance: ${instanceId})...`);
      const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          to: recipientPhone,
          body: messageText
        })
      });
      const data = await response.json();
      console.log('UltraMsg API response:', data);
    } else {
      console.log(`--- UltraMsg Credentials Missing ---`);
      console.log(`Message would be sent to: ${recipientPhone}`);
      console.log(`Message Content: \n${messageText}\n`);
    }

    res.json({
      success: true,
      message: 'Application registered and sent to WhatsApp automatically.'
    });
  } catch (err) {
    console.error('Error dispatching WhatsApp from backend via UltraMsg:', err);
    res.json({
      success: true,
      message: 'Application registered (WhatsApp dispatch failed).'
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
