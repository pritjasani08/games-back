const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: "*"
}));
app.use(express.json());

// Setup multer for local file uploads
const upload = multer({
  storage: multer.memoryStorage()
});



// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Middleware for Admin Authentication
const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Forbidden. Incorrect password.' });
  }
  next();
};

// POST upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = `${Date.now()}-${file.originalname}`;

    // Upload to Supabase bucket (app-logos)
    const { data, error } = await supabase.storage
      .from('app-logos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('app-logos')
      .getPublicUrl(fileName);

    res.json({
      success: true,
      url: publicUrl.publicUrl
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all apps
app.get('/api/apps', async (req, res) => {
  try {
    const { data: apps, error } = await supabase
      .from('apps')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(apps);
  } catch (error) {
    console.error('Error fetching all apps:', error.message);
    res.status(500).json({ error: 'Server error fetching apps' });
  }
});

// GET recent 10 apps
app.get('/api/apps/recent', async (req, res) => {
  try {
    const { data: apps, error } = await supabase
      .from('apps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json(apps);
  } catch (error) {
    console.error('Error fetching recent apps:', error.message);
    res.status(500).json({ error: 'Server error fetching recent apps' });
  }
});

// POST add app (Admin only)
app.post('/api/apps', adminAuth, async (req, res) => {
  try {
    const { name, logo_url, download_link } = req.body;
    if (!name || !logo_url || !download_link) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: app, error } = await supabase
      .from('apps')
      .insert([{ name, logo_url, download_link }])
      .select();

    if (error) throw error;
    res.status(201).json(app[0]);
  } catch (error) {
    console.error('Error adding app:', error.message);
    res.status(500).json({ error: 'Server error adding app' });
  }
});

// DELETE app (Admin only)
app.delete('/api/apps/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('apps')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'App deleted successfully' });
  } catch (error) {
    console.error('Error deleting app:', error.message);
    res.status(500).json({ error: 'Server error deleting app' });
  }
});

// POST contact email
app.post('/api/contact', async (req, res) => {
  try {
    const { email, topic, message } = req.body;
    if (!email || !topic || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Send email
    await transporter.sendMail({
      from: `"${email}" <${email}>`, // sender address (from the form)
      to: process.env.SMTP_USER, // site admin email receiving the message
      subject: `MSU Games Contact: ${topic}`,
      text: `From: ${email}\nTopic: ${topic}\n\nMessage:\n${message}`,
    });

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({ error: 'Server error sending email', details: error.message });
  }
});

module.exports = (req, res) => {
  return app(req, res);
};
