import express from 'express';
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
  // Silent fallback for Vercel Serverless environment
}

// Server-side SMTP configuration cache
let serverSmtpCache = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  user: (process.env.SMTP_USER || 'bsfijerubc@gmail.com').trim(),
  pass: (process.env.SMTP_PASS || 'ztjsrtqoyicwlffk').trim(),
  fromEmail: (process.env.SMTP_FROM_EMAIL || 'bsfijerubc@gmail.com').trim(),
  fromName: (process.env.SMTP_FROM_NAME || 'Event Notifications').trim(),
};

// Admin Security & Progressive Lockout Server State
interface SecurityLog {
  timestamp: string;
  event: string;
  ip?: string;
  details?: string;
}

interface AdminSecurityState {
  failedAttempts: number;
  lockoutUntil: number | null;
  isSuspended: boolean;
  recoveryToken: string | null;
  recoveryTokenExpires: number | null;
  logs: SecurityLog[];
}

let adminSecurityState: AdminSecurityState = {
  failedAttempts: 0,
  lockoutUntil: null,
  isSuspended: false,
  recoveryToken: null,
  recoveryTokenExpires: null,
  logs: [],
};

const app = express();
app.use(express.json());

// Rate limiter helper for Vercel Serverless
const ipMap: Record<string, { count: number; resetTime: number }> = {};
function adminRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (!ipMap[ip] || now > ipMap[ip].resetTime) {
    ipMap[ip] = { count: 1, resetTime: now + 60000 };
  } else {
    ipMap[ip].count++;
  }
  if (ipMap[ip].count > 35) {
    return res.status(429).json({ success: false, message: 'Rate limit exceeded. Please try again in a minute.' });
  }
  next();
}

async function sendRecoveryEmail(token: string, req: express.Request) {
  const adminEmail = 'isholafelix609@gmail.com';
  const hostHeader = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const origin = req.headers.origin || `${protocol}://${hostHeader}`;
  const recoveryLink = `${origin}/admin?recovery_token=${token}`;

  const host = serverSmtpCache.host || 'smtp.gmail.com';
  const port = Number(serverSmtpCache.port) || 587;
  const user = serverSmtpCache.user || 'bsfijerubc@gmail.com';
  const pass = serverSmtpCache.pass || 'ztjsrtqoyicwlffk';
  const fromEmail = serverSmtpCache.fromEmail || user;
  const fromName = serverSmtpCache.fromName || 'Event Security Operations';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: Number(port) === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });

  const subject = '[URGENT] Security Alert: Admin Account Suspended & Recovery Link';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff;">
      <div style="background: #dc2626; color: #ffffff; padding: 16px 24px; border-radius: 8px 8px 0 0; font-weight: bold; font-size: 18px;">
        ⚠️ Administrator Security Alert
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Admin Account Suspended</h2>
        <p style="color: #334155; line-height: 1.6;">
          Your administrator account for <strong>Event Management Platform</strong> was suspended following <strong>4 cumulative incorrect password attempts</strong>.
        </p>
        <p style="color: #334155; line-height: 1.6;">
          To restore admin login capability, click the secure single-use recovery button below (valid for 15 minutes):
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${recoveryLink}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
            Restore Admin Account Access
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:</p>
        <div style="background: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; color: #334155;">
          ${recoveryLink}
        </div>
        <p style="color: #64748b; font-size: 13px; margin-top: 16px;">
          Single-use recovery token: <strong>${token}</strong>
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          If you did not perform these login attempts, your account remains secure and access can only be restored via this email.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: adminEmail,
    subject,
    html,
  });
}

// Admin Security Status Endpoint
app.get('/api/admin/status', adminRateLimit, (req, res) => {
  const now = Date.now();
  let locked = false;
  let lockoutRemainingMs = 0;

  if (adminSecurityState.lockoutUntil) {
    if (now < adminSecurityState.lockoutUntil) {
      locked = true;
      lockoutRemainingMs = adminSecurityState.lockoutUntil - now;
    } else {
      adminSecurityState.lockoutUntil = null;
    }
  }

  return res.status(200).json({
    success: true,
    failedAttempts: adminSecurityState.failedAttempts,
    isLocked: locked,
    lockoutRemainingMs,
    isSuspended: adminSecurityState.isSuspended,
    message: adminSecurityState.isSuspended
      ? 'Admin login is suspended due to 4 cumulative failed attempts. An email recovery link has been sent to your administrator address.'
      : locked
      ? `Login temporarily locked for 10 minutes.`
      : 'Admin security status OK',
  });
});

// Admin Login Endpoint with Progressive Lockout Protection
app.post('/api/admin/login', adminRateLimit, async (req, res) => {
  const { passcode } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (adminSecurityState.isSuspended) {
    return res.status(403).json({
      success: false,
      status: 'suspended',
      isSuspended: true,
      message: 'Admin login is suspended due to 4 cumulative failed attempts. Please check your administrator email for your single-use recovery link.',
    });
  }

  if (adminSecurityState.lockoutUntil) {
    if (now < adminSecurityState.lockoutUntil) {
      const remainingMs = adminSecurityState.lockoutUntil - now;
      return res.status(429).json({
        success: false,
        status: 'locked',
        isLocked: true,
        lockoutRemainingMs: remainingMs,
        message: `Login temporarily locked for 10 minutes. Please wait ${Math.ceil(remainingMs / 60000)} minute(s) before trying again.`,
      });
    } else {
      adminSecurityState.lockoutUntil = null;
    }
  }

  const CORRECT_PASS = 'Worship123';
  if (passcode === CORRECT_PASS) {
    adminSecurityState.failedAttempts = 0;
    adminSecurityState.lockoutUntil = null;
    adminSecurityState.isSuspended = false;
    adminSecurityState.recoveryToken = null;
    return res.status(200).json({ success: true, message: 'Admin authenticated successfully.' });
  }

  adminSecurityState.failedAttempts += 1;
  const attempts = adminSecurityState.failedAttempts;

  if (attempts === 2) {
    adminSecurityState.lockoutUntil = now + 10 * 60 * 1000;
    return res.status(429).json({
      success: false,
      status: 'locked',
      isLocked: true,
      failedAttempts: 2,
      lockoutRemainingMs: 10 * 60 * 1000,
      message: 'Too many incorrect attempts. Login locked for 10 minutes.',
    });
  }

  if (attempts >= 4) {
    adminSecurityState.isSuspended = true;
    adminSecurityState.lockoutUntil = null;

    const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    adminSecurityState.recoveryToken = token;
    adminSecurityState.recoveryTokenExpires = now + 15 * 60 * 1000;

    sendRecoveryEmail(token, req).catch((e) => console.error('Failed to send recovery email:', e));

    return res.status(403).json({
      success: false,
      status: 'suspended',
      isSuspended: true,
      failedAttempts: 4,
      message: 'Admin login suspended due to 4 cumulative failed attempts. A security recovery email has been sent to your administrator address.',
    });
  }

  return res.status(401).json({
    success: false,
    status: 'incorrect',
    failedAttempts: attempts,
    message: `Incorrect passcode. Attempt ${attempts} of 4.`,
  });
});

// Single-use Admin Recovery Endpoint
app.post('/api/admin/recover', adminRateLimit, (req, res) => {
  const { token } = req.body;
  const now = Date.now();

  if (!token || typeof token !== 'string' || token.trim() !== adminSecurityState.recoveryToken) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired recovery token.',
    });
  }

  if (adminSecurityState.recoveryTokenExpires && now > adminSecurityState.recoveryTokenExpires) {
    adminSecurityState.recoveryToken = null;
    return res.status(400).json({
      success: false,
      message: 'Recovery token has expired (15-minute limit). Please request a new recovery procedure.',
    });
  }

  adminSecurityState.failedAttempts = 0;
  adminSecurityState.isSuspended = false;
  adminSecurityState.lockoutUntil = null;
  adminSecurityState.recoveryToken = null;
  adminSecurityState.recoveryTokenExpires = null;

  return res.status(200).json({
    success: true,
    message: 'Admin account login access successfully restored. You may now log in with your admin passcode.',
  });
});

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
        // Fallback
      }
    }

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

    const host = bodyHost || serverSmtpCache.host || dbSettings?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(bodyPort || serverSmtpCache.port || dbSettings?.port || process.env.SMTP_PORT || 587);
    const user = (bodyUser !== undefined && bodyUser !== '' ? bodyUser : (serverSmtpCache.user || dbSettings?.user || process.env.SMTP_USER || 'bsfijerubc@gmail.com')).trim();
    const pass = (bodyPass !== undefined && bodyPass !== '' ? bodyPass : (serverSmtpCache.pass || dbSettings?.pass || process.env.SMTP_PASS || 'ztjsrtqoyicwlffk')).trim();
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

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Number(port) === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject || 'Event Registration Pass',
      text: text || 'Thank you for registering.',
      html: html || `<p>${text || 'Thank you for registering.'}</p>`,
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    let errorMessage = error?.message || 'Failed to connect to email server or deliver message.';
    if (error?.code === 'EAUTH' || errorMessage.includes('535') || errorMessage.includes('Username and Password not accepted')) {
      errorMessage = 'Email Authentication Failed (535): Invalid account email or password. For Gmail, make sure to use a 16-character App Password.';
    } else if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED' || error?.code === 'ESOCKET') {
      errorMessage = `Network Connection Timeout: Unable to connect to host on port. Please verify host and port (587 or 465).`;
    }
    return res.status(500).json({ success: false, error: errorMessage });
  }
});

export default app;
