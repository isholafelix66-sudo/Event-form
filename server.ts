import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';


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

// Rate limiter for admin security endpoints
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

  console.log(`[SECURITY] Recovery notification dispatched to ${adminEmail} (Token: ${token})`);
}

async function createServer() {
  const app = express();
  app.use(express.json());

  // === MOUNT ALL API ROUTES FIRST BEFORE VITE / STATIC MIDDLEWARE ===

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
        ? `Login temporarily locked for 10 minutes. Lockout remaining: ${Math.ceil(lockoutRemainingMs / 1000)} seconds.`
        : 'Admin security status OK',
    });
  });

  // Admin Login Endpoint with Progressive Lockout Protection
  app.post('/api/admin/login', adminRateLimit, async (req, res) => {
    const { passcode } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // 1. If account is suspended
    if (adminSecurityState.isSuspended) {
      adminSecurityState.logs.push({
        timestamp: new Date().toISOString(),
        event: 'LOGIN_ATTEMPT_REJECTED_SUSPENDED',
        ip,
      });
      return res.status(403).json({
        success: false,
        status: 'suspended',
        isSuspended: true,
        message: 'Admin login is suspended due to 4 cumulative failed attempts. Please check your administrator email for your single-use recovery link.',
      });
    }

    // 2. If locked for 10 minutes
    if (adminSecurityState.lockoutUntil) {
      if (now < adminSecurityState.lockoutUntil) {
        const remainingMs = adminSecurityState.lockoutUntil - now;
        adminSecurityState.logs.push({
          timestamp: new Date().toISOString(),
          event: 'LOGIN_ATTEMPT_REJECTED_LOCKED',
          ip,
        });
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

    // 3. Verify Passcode
    const CORRECT_PASS = 'Worship123';
    if (passcode === CORRECT_PASS) {
      adminSecurityState.failedAttempts = 0;
      adminSecurityState.lockoutUntil = null;
      adminSecurityState.isSuspended = false;
      adminSecurityState.recoveryToken = null;
      adminSecurityState.logs.push({
        timestamp: new Date().toISOString(),
        event: 'LOGIN_SUCCESS',
        ip,
      });
      console.log(`[SECURITY] Admin login SUCCESSFUL from IP ${ip}`);
      return res.status(200).json({ success: true, message: 'Admin authenticated successfully.' });
    }

    // 4. Handle Incorrect Passcode
    adminSecurityState.failedAttempts += 1;
    const attempts = adminSecurityState.failedAttempts;

    adminSecurityState.logs.push({
      timestamp: new Date().toISOString(),
      event: 'LOGIN_FAILED',
      ip,
      details: `Attempt ${attempts} of 4`,
    });
    console.warn(`[SECURITY WARNING] Admin login FAILED attempt ${attempts} of 4 from IP ${ip}`);

    // Second failed attempt triggers 10-minute lockout
    if (attempts === 2) {
      adminSecurityState.lockoutUntil = now + 10 * 60 * 1000;
      adminSecurityState.logs.push({
        timestamp: new Date().toISOString(),
        event: 'LOCKOUT_ACTIVATED_10_MIN',
        ip,
      });
      console.warn(`[SECURITY ALERT] 10-minute login lockout activated until ${new Date(adminSecurityState.lockoutUntil).toISOString()}`);
      return res.status(429).json({
        success: false,
        status: 'locked',
        isLocked: true,
        failedAttempts: 2,
        lockoutRemainingMs: 10 * 60 * 1000,
        message: 'Too many incorrect attempts. Login locked for 10 minutes.',
      });
    }

    // Fourth cumulative failed attempt suspends account and sends recovery email
    if (attempts >= 4) {
      adminSecurityState.isSuspended = true;
      adminSecurityState.lockoutUntil = null;

      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      adminSecurityState.recoveryToken = token;
      adminSecurityState.recoveryTokenExpires = now + 15 * 60 * 1000;

      adminSecurityState.logs.push({
        timestamp: new Date().toISOString(),
        event: 'ACCOUNT_SUSPENDED_RECOVERY_SENT',
        ip,
      });
      console.warn(`[SECURITY ALERT] Admin account SUSPENDED (4 failed attempts). Dispatching recovery token: ${token}`);

      sendRecoveryEmail(token, req).catch((e) => console.error('Failed to send recovery email:', e));

      return res.status(403).json({
        success: false,
        status: 'suspended',
        isSuspended: true,
        failedAttempts: 4,
        message: 'Admin login suspended due to 4 cumulative failed attempts. A security recovery email has been sent to your administrator address.',
      });
    }

    // First or third failed attempt
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
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!token || typeof token !== 'string' || token.trim() !== adminSecurityState.recoveryToken) {
      adminSecurityState.logs.push({
        timestamp: new Date().toISOString(),
        event: 'RECOVERY_FAILED_INVALID_TOKEN',
        ip,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired recovery token.',
      });
    }

    if (adminSecurityState.recoveryTokenExpires && now > adminSecurityState.recoveryTokenExpires) {
      adminSecurityState.recoveryToken = null;
      adminSecurityState.logs.push({
        timestamp: new Date().toISOString(),
        event: 'RECOVERY_FAILED_TOKEN_EXPIRED',
        ip,
      });
      return res.status(400).json({
        success: false,
        message: 'Recovery token has expired (15-minute limit). Please request a new recovery procedure.',
      });
    }

    // Reset security counters and invalidate single-use token
    adminSecurityState.failedAttempts = 0;
    adminSecurityState.isSuspended = false;
    adminSecurityState.lockoutUntil = null;
    adminSecurityState.recoveryToken = null;
    adminSecurityState.recoveryTokenExpires = null;

    adminSecurityState.logs.push({
      timestamp: new Date().toISOString(),
      event: 'ACCOUNT_RECOVERED_SUCCESSFULLY',
      ip,
    });

    console.log(`[SECURITY SUCCESS] Admin account access successfully restored via single-use recovery token from IP ${ip}`);

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

  // Private-Link Event Help Desk AI Endpoint (Gemini API)
  app.post('/api/helpdesk/chat', async (req, res) => {
    const { userMessage, knowledgeBase, chatHistory } = req.body;

    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      return res.status(400).json({ success: false, error: 'User message is required.' });
    }

    if (!knowledgeBase || !knowledgeBase.eventTitle) {
      return res.status(400).json({ success: false, error: 'Knowledge base context is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';

    // Extract dynamic sections text if available
    const sectionsText = Array.isArray(knowledgeBase.sections) && knowledgeBase.sections.length > 0
      ? knowledgeBase.sections.map((s: any) => `### SECTION: ${s.title}\n${s.content}`).join('\n\n')
      : '';

    const faqsListText = Array.isArray(knowledgeBase.faqs) && knowledgeBase.faqs.length > 0
      ? knowledgeBase.faqs.map((f: any, i: number) => `${i + 1}. [Category: ${f.category || 'General'}]\n   Q: ${f.question}\n   A: ${f.answer}`).join('\n\n')
      : 'No custom FAQs listed.';

    const contactsListText = Array.isArray(knowledgeBase.contacts) && knowledgeBase.contacts.length > 0
      ? knowledgeBase.contacts.map((c: any) => `- ${c.label || c.type}: ${c.value}`).join('\n')
      : `Phone: ${knowledgeBase.contactPhone || 'N/A'}, Email: ${knowledgeBase.contactEmail || 'N/A'}`;

    // If API key is not configured, return polite response with fallback
    if (!apiKey) {
      return res.status(200).json({
        success: true,
        answer: knowledgeBase.fallbackMessage || `I don't have that specific detail in our event guide right now. Please reach out to our support team directly using the contact options below:`,
        requiresFallback: true,
        fallbackDetails: {
          message: knowledgeBase.fallbackMessage || 'Please reach out to our event support team:',
          contacts: knowledgeBase.contacts || [],
          contactPhone: knowledgeBase.contactPhone,
          contactEmail: knowledgeBase.contactEmail,
          whatsappLink: knowledgeBase.whatsappLink,
          socialLink: knowledgeBase.socialLink,
          fallbackLink: knowledgeBase.fallbackLink,
        },
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are the friendly, intelligent AI Event Concierge for "${knowledgeBase.eventTitle}".
Your objective is to assist visitors in a warm, natural, highly conversational manner using strictly the event knowledge base context below.

CONVERSATIONAL & ACCURACY RULES:
1. NATURAL GREETINGS & CASUAL CHAT: Respond warmly to greetings like "Hello", "Hi", "Good morning", "Thanks", or questions about who you are. DO NOT output [FALLBACK_REQUIRED] or dump contact details for simple greetings or polite banter.
2. STRICT EVENT GROUNDING: When answering specific event questions (about schedule, venue, dress code, tickets, rules, catering, etc.), use ONLY facts explicitly stated in the knowledge base below. Never invent or guess dates, prices, parking fees, or details not written here.
3. CONTEXT RECALL: Remember previous messages in the chat history. Maintain smooth conversation flow so users don't have to repeat themselves.
4. UNANSWERABLE EVENT QUESTIONS: If the user asks a specific factual question about event details that is NOT documented anywhere in the knowledge base below, state politely that the requested detail isn't in the event guide right now, and include the exact tag "[FALLBACK_REQUIRED]" anywhere in your response so contact options appear.

=== EVENT KNOWLEDGE BASE CONTEXT ===
EVENT TITLE: ${knowledgeBase.eventTitle}
OVERVIEW & ABOUT: ${knowledgeBase.overview || 'N/A'}
VENUE & PARKING DIRECTIONS: ${knowledgeBase.venueDetails || 'N/A'}
SCHEDULE & TIMETABLE: ${knowledgeBase.scheduleDetails || 'N/A'}
DRESS CODE & WHAT TO BRING: ${knowledgeBase.dressCode || 'N/A'}

${sectionsText ? `ADDITIONAL KNOWLEDGE SECTIONS:\n${sectionsText}\n` : ''}
FREQUENTLY ASKED QUESTIONS (FAQS):
${faqsListText}

CONFIGURED CONTACT CHANNELS:
${contactsListText}
===================================`;

      // Build turn contents with history if available
      const contents: any[] = [];
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        // Take last 8 turns for efficiency and fast response speed
        const recentHistory = chatHistory.slice(-8);
        for (const msg of recentHistory) {
          if (msg.text) {
            contents.push({
              role: msg.sender === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }],
            });
          }
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: userMessage.trim() }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const fullText = response.text || '';
      const requiresFallback = fullText.includes('[FALLBACK_REQUIRED]');
      const cleanAnswer = fullText.replace(/\[FALLBACK_REQUIRED\]/g, '').trim();

      return res.status(200).json({
        success: true,
        answer: cleanAnswer || (requiresFallback ? 'I don\'t have that specific detail in our event guide right now.' : 'How else can I help you regarding this event?'),
        requiresFallback,
        fallbackDetails: {
          message: knowledgeBase.fallbackMessage || 'For further assistance, our event support team is available via the contact options below:',
          contacts: knowledgeBase.contacts || [],
          contactPhone: knowledgeBase.contactPhone,
          contactEmail: knowledgeBase.contactEmail,
          whatsappLink: knowledgeBase.whatsappLink,
          socialLink: knowledgeBase.socialLink,
          fallbackLink: knowledgeBase.fallbackLink,
        },
      });
    } catch (err: any) {
      console.error('Gemini API Helpdesk Error:', err);
      return res.status(200).json({
        success: true,
        answer: knowledgeBase.fallbackMessage || 'I am unable to process that specific query right now. Please reach out to our event support team below:',
        requiresFallback: true,
        fallbackDetails: {
          message: knowledgeBase.fallbackMessage || 'Please reach out to our event support team:',
          contacts: knowledgeBase.contacts || [],
          contactPhone: knowledgeBase.contactPhone,
          contactEmail: knowledgeBase.contactEmail,
          whatsappLink: knowledgeBase.whatsappLink,
          socialLink: knowledgeBase.socialLink,
          fallbackLink: knowledgeBase.fallbackLink,
        },
      });
    }
  });

  // Bulk Knowledge Base Document Parser Endpoint (Gemini API)
  app.post('/api/helpdesk/parse-kb', async (req, res) => {
    const { rawText, eventTitle } = req.body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'Raw text document content is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Server Gemini API key is required to perform intelligent document parsing.',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Analyze and structure the following raw document text for the event "${eventTitle || 'Event'}".
Extract and organize all information into clean JSON without inventing details or silently discarding facts.

Return ONLY a valid JSON object matching this exact structure:
{
  "overview": "Summary or about the event",
  "venueDetails": "Location, address, hall, directions, parking",
  "scheduleDetails": "Dates, timetable, session breakdown, door opening times",
  "dressCode": "Dress code guidelines or items to bring",
  "sections": [
    {
      "title": "Section Name (e.g. Registration Guidelines, Keynote Speakers, Workshop Tracks)",
      "content": "Detailed text content for this section"
    }
  ],
  "faqs": [
    {
      "question": "Question text",
      "answer": "Factual answer extracted from the document",
      "category": "General | Venue | Schedule | Registration | Dietary | Other"
    }
  ],
  "contacts": [
    {
      "type": "phone | whatsapp | email | social | website | other",
      "label": "Contact Channel Label (e.g. Help Desk Phone, Support Email)",
      "value": "The actual phone, email, or URL string"
    }
  ]
}

DOCUMENT TEXT:
${rawText.trim()}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(responseText);
      } catch (pErr) {
        console.warn('JSON parse fallback for parse-kb:', pErr);
        parsedData = {
          overview: rawText.substring(0, 500),
          sections: [{ title: 'Imported Overview', content: rawText }],
          faqs: [],
          contacts: [],
        };
      }

      return res.status(200).json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Gemini KB Parsing Error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to analyze and structure pasted knowledge base document.',
      });
    }
  });


  // === MOUNT VITE / STATIC MIDDLEWARE AFTER API ROUTES ===

  if (isProd) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

createServer();
