import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

// Safely initialize Firebase Admin
let db: any = null;
try {
  initializeApp();
  db = getFirestore();
} catch (e) {
  console.warn('Firebase Admin init warning (will use request body or ENV for SMTP):', e);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// Server-side SMTP configuration cache
let serverSmtpCache = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  user: (process.env.SMTP_USER || 'bsfijerubc@gmail.com').trim(),
  pass: (process.env.SMTP_PASS || 'ztjsrtqoyicwlffk').trim(),
  fromEmail: (process.env.SMTP_FROM_EMAIL || 'bsfijerubc@gmail.com').trim(),
  fromName: (process.env.SMTP_FROM_NAME || 'Event Notifications').trim(),
};

async function createServer() {
  const app = express();
  app.use(express.json());

  if (isProd) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Update server SMTP configuration cache endpoint
  app.post('/api/save-smtp', (req, res) => {
    const { host, port, user, pass, fromEmail, fromName } = req.body;
    serverSmtpCache = {
      host: host || 'smtp.gmail.com',
      port: Number(port) || 587,
      user: (user || '').trim(),
      pass: (pass || '').trim(),
      fromEmail: (fromEmail || user || '').trim(),
      fromName: (fromName || 'Event Notifications').trim(),
    };
    console.log(`Server SMTP configuration updated for user: ${serverSmtpCache.user || '(none)'}`);
    return res.status(200).json({ success: true, message: 'Server SMTP settings updated successfully.' });
  });

  // Email sending API endpoint
  app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, text, host: bodyHost, port: bodyPort, user: bodyUser, pass: bodyPass, fromEmail: bodyFromEmail, fromName: bodyFromName } = req.body;

    try {
      let dbSettings: any = null;
      if (db) {
        try {
          const settingsDoc = await db.collection('settings').doc('smtp').get();
          if (settingsDoc.exists) {
            dbSettings = settingsDoc.data();
          }
        } catch (dbErr) {
          console.warn('Could not read SMTP settings from Firestore Admin, using request body/cache fallback:', dbErr);
        }
      }

      // If credentials passed in request body, update server cache for future requests
      if (bodyUser && bodyPass) {
        serverSmtpCache = {
          host: bodyHost || serverSmtpCache.host || 'smtp.gmail.com',
          port: Number(bodyPort) || serverSmtpCache.port || 587,
          user: (bodyUser || '').trim(),
          pass: (bodyPass || '').trim(),
          fromEmail: (bodyFromEmail || serverSmtpCache.fromEmail || bodyUser || '').trim(),
          fromName: (bodyFromName || serverSmtpCache.fromName || 'Event Notifications').trim(),
        };
      }

      // Resolve SMTP configuration in order of priority: Request Body -> Server Cache -> Firestore DB -> Env Vars
      const host = bodyHost || serverSmtpCache.host || dbSettings?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = Number(bodyPort || serverSmtpCache.port || dbSettings?.port || process.env.SMTP_PORT || 587);
      const user = (bodyUser !== undefined && bodyUser !== '' ? bodyUser : (serverSmtpCache.user || dbSettings?.user || process.env.SMTP_USER || '')).trim();
      const pass = (bodyPass !== undefined && bodyPass !== '' ? bodyPass : (serverSmtpCache.pass || dbSettings?.pass || process.env.SMTP_PASS || '')).trim();
      const fromEmail = (bodyFromEmail || serverSmtpCache.fromEmail || dbSettings?.fromEmail || process.env.SMTP_FROM_EMAIL || user).trim();
      const fromName = (bodyFromName || serverSmtpCache.fromName || dbSettings?.fromName || process.env.SMTP_FROM_NAME || 'Event Notifications').trim();

      if (!user || !pass) {
        return res.status(400).json({
          success: false,
          error: 'Email delivery credentials are missing. Please configure your Account Email and Password in Email Settings.',
        });
      }

      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'Recipient email address is required.',
        });
      }

      // Create Nodemailer Transporter with resilient timeouts
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: Number(port) === 465, // true for port 465, false for 587 or 25
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false, // Prevent SSL certificate mismatch errors
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // Dispatch Email
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: subject || 'Event Registration Pass',
        text: text || 'Thank you for registering.',
        html: html || `<p>${text || 'Thank you for registering.'}</p>`,
      });

      console.log(`Email dispatched successfully to ${to} (Message ID: ${info.messageId})`);
      return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error('Email delivery failure:', error);
      let errorMessage = error?.message || 'Failed to connect to email server or deliver message.';
      if (error?.code === 'EAUTH' || errorMessage.includes('535') || errorMessage.includes('Username and Password not accepted')) {
        errorMessage = 'Email Authentication Failed (535): Invalid account email or password. For Gmail, make sure to use a 16-character App Password.';
      } else if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED' || error?.code === 'ESOCKET') {
        errorMessage = `Network Connection Timeout: Unable to connect to host on port. Please verify host and port (587 or 465).`;
      }
      return res.status(500).json({ success: false, error: errorMessage });
    }
  });

  if (isProd) {
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

createServer();
