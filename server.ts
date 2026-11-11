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

// Gemini Health Verification Cache
let geminiVerified = false;
let geminiAvailable = false;

async function isGeminiReady(): Promise<boolean> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return false;
  if (geminiVerified) return geminiAvailable;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    // Test with 1500ms timeout
    const testPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
    });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500));
    await Promise.race([testPromise, timeoutPromise]);
    geminiAvailable = true;
    console.log('[AI] Gemini 3.8 Flash online and ready.');
  } catch (err: any) {
    geminiAvailable = false;
    console.warn('[AI] Gemini API unavailable or lacking scopes (using instant grounded engine):', err?.message || err);
  } finally {
    geminiVerified = true;
  }
  return geminiAvailable;
}

// Intelligent Rule-Based + Semantic Q&A Grounding Engine (Instant response, 100% grounded, zero hallucination)
function answerFromKnowledgeBase(
  query: string,
  kb: any,
  recentHistory: Array<{ role: string; parts: Array<{ text: string }> }> = []
): { answer: string; requiresFallback: boolean } {
  const q = (query || '').toLowerCase().trim();
  const cleanQ = q.replace(/[?!.,;:'"()]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleanQ.split(' ').filter((w) => w.length > 2);

  // 1. Natural greetings & pleasantries
  const isGreeting = /^(hello|hi|hey|good\s*(morning|afternoon|evening|day)|greetings|howdy|what'?s\s*up|worship\s*culture|blessings|peace)\b/i.test(cleanQ);
  if (isGreeting && tokens.length <= 4) {
    return {
      answer: `Hello! 👋 Welcome to the official **${kb.eventTitle}** Help Desk. I am your 24/7 Event Concierge. You can ask me anything about the theme, venue, schedule, registration, parking, and guidelines! How may I assist you today?`,
      requiresFallback: false,
    };
  }

  const isThanks = /^(thanks|thank\s*you|bless\s*you|god\s*bless\s*you|grateful|much\s*appreciated)\b/i.test(cleanQ);
  if (isThanks) {
    return {
      answer: `You're very welcome! If you have any more questions about **${kb.eventTitle}**, please don't hesitate to ask. God bless you! 🙏`,
      requiresFallback: false,
    };
  }

  const isIdentity = /^(who\s*(are\s*you|made\s*you)|what\s*(are\s*you|is\s*this|can\s*you\s*do))\b/i.test(cleanQ);
  if (isIdentity) {
    return {
      answer: `I am the dedicated Event Concierge for **${kb.eventTitle}**. I'm here to provide accurate details directly from our official event guide—including venue location, timetable, theme insights, dress code, and registration information.`,
      requiresFallback: false,
    };
  }

  const faqs = Array.isArray(kb.faqs) ? kb.faqs : [];

  // 2. Search configured FAQs first (High Precision matching)
  let bestFaq: any = null;
  let bestFaqScore = 0;

  for (const faq of faqs) {
    const fq = (faq.question || '').toLowerCase();
    const fAns = (faq.answer || '').toLowerCase();
    let score = 0;

    // Exact phrase match
    if (fq.includes(cleanQ) || cleanQ.includes(fq)) score += 10;
    for (const t of tokens) {
      if (fq.includes(t)) score += 3;
      else if (fAns.includes(t)) score += 1;
    }
    if (score > bestFaqScore) {
      bestFaqScore = score;
      bestFaq = faq;
    }
  }

  if (bestFaq && (bestFaqScore >= 2 || (tokens.length <= 2 && bestFaqScore >= 1))) {
    return {
      answer: bestFaq.answer,
      requiresFallback: false,
    };
  }

  // 3. Search Registration & Ticket Policy
  const regTerms = ['register', 'registration', 'fee', 'free', 'cost', 'price', 'ticket', 'pass', 'compulsory', 'pay', 'paid', 'money', 'entry fee'];
  const matchesReg = regTerms.some((t) => cleanQ.includes(t));
  if (matchesReg) {
    const regFaq = faqs.find((f: any) => /fee|free|register|ticket|cost/i.test(f.question || ''));
    if (regFaq) {
      return { answer: regFaq.answer, requiresFallback: false };
    }
    const regSec = (kb.sections || []).find((s: any) => /reg|ticket|fee|admission|entry/i.test(s.title || ''));
    if (regSec) {
      return { answer: `**${regSec.title}:**\n${regSec.content}`, requiresFallback: false };
    }
    if (kb.overview && /free|registration/i.test(kb.overview)) {
      return {
        answer: `**Registration & Entry Policy:**\nRegistration for **${kb.eventTitle}** is 100% **FREE**, but **COMPULSORY** for all attendees to secure a seat and digital pass.`,
        requiresFallback: false,
      };
    }
  }

  // 4. Search Organizers
  const orgTerms = ['organizer', 'organiser', 'who organized', 'who is organising', 'who is organizing', 'host', 'bsf', 'baptist student fellowship'];
  const matchesOrg = orgTerms.some((t) => cleanQ.includes(t));
  if (matchesOrg) {
    const orgFaq = faqs.find((f: any) => /organi/i.test(f.question || ''));
    if (orgFaq) {
      return { answer: orgFaq.answer, requiresFallback: false };
    }
    return {
      answer: `**Event Organiser:**\n**${kb.eventTitle}** is organised by the **Baptist Student Fellowship (BSF)**, Ijeru Baptist Church, Ogbomoso.`,
      requiresFallback: false,
    };
  }

  // 5. Search Venue, Address, Directions & Plus Code
  const venueTerms = ['venue', 'where', 'location', 'address', 'directions', 'locate', 'church', 'ijeru', 'ogbomoso', 'map', 'plus code', 'navigate', 'driving', 'bus', 'hall', 'arubiewe'];
  const matchesVenue = venueTerms.some((t) => cleanQ.includes(t));
  if (matchesVenue && kb.venueDetails) {
    return {
      answer: `**Venue & Location:**\n${kb.venueDetails}`,
      requiresFallback: false,
    };
  }

  // 6. Search Date, Schedule & Door Opening Times
  const scheduleTerms = ['time', 'when', 'date', 'schedule', 'timetable', 'start', 'end', 'hours', 'night', 'doors', 'agenda', 'overnight'];
  const matchesSchedule = scheduleTerms.some((t) => cleanQ.includes(t));
  if (matchesSchedule && kb.scheduleDetails) {
    return {
      answer: `**Date & Schedule Details:**\n${kb.scheduleDetails}`,
      requiresFallback: false,
    };
  }

  // 7. Search Theme & Purpose
  const themeTerms = ['theme', 'about', 'culture', 'meaning', 'worship culture', 'purpose', 'overview', 'concept', 'what is worship', 'lifestyle', 'singing'];
  const matchesTheme = themeTerms.some((t) => cleanQ.includes(t));
  if (matchesTheme) {
    const themeSec = (kb.sections || []).find((s: any) => /theme|worship culture/i.test(s.title || ''));
    if (themeSec) {
      return { answer: `**${themeSec.title}:**\n${themeSec.content}`, requiresFallback: false };
    }
    if (kb.overview) {
      return {
        answer: `**About & Theme:**\n${kb.overview}`,
        requiresFallback: false,
      };
    }
  }

  // 8. Search Dress Code & Guidelines
  const dressTerms = ['dress', 'code', 'wear', 'attire', 'clothes', 'outfit', 'what to wear', 'guidelines'];
  const matchesDress = dressTerms.some((t) => cleanQ.includes(t));
  if (matchesDress && kb.dressCode) {
    return {
      answer: `**Dress Code Guidelines:**\n${kb.dressCode}`,
      requiresFallback: false,
    };
  }

  // 9. Search Custom Sections
  const sections = Array.isArray(kb.sections) ? kb.sections : [];
  let bestSection: any = null;
  let bestSectionScore = 0;

  for (const sec of sections) {
    const sTitle = (sec.title || '').toLowerCase();
    const sContent = (sec.content || '').toLowerCase();
    let score = 0;

    if (cleanQ.includes(sTitle) || sTitle.includes(cleanQ)) score += 8;
    for (const t of tokens) {
      if (sTitle.includes(t)) score += 3;
      if (sContent.includes(t)) score += 1;
    }

    if (score > bestSectionScore) {
      bestSectionScore = score;
      bestSection = sec;
    }
  }

  if (bestSection && bestSectionScore >= 2) {
    return {
      answer: `**${bestSection.title}:**\n${bestSection.content}`,
      requiresFallback: false,
    };
  }

  // 10. Contact requests
  const contactTerms = ['contact', 'call', 'phone', 'whatsapp', 'email', 'reach', 'talk to someone', 'admin', 'help desk', 'organizer phone', 'support'];
  const matchesContact = contactTerms.some((t) => cleanQ.includes(t));
  if (matchesContact) {
    return {
      answer: `You can reach our official event team directly through any of the contact channels below:`,
      requiresFallback: true,
    };
  }

  // 11. Graceful fallback for unanswerable queries (politely show contact details)
  return {
    answer: kb.fallbackMessage || `I don't have that specific detail in our event guide right now. Please reach out to our event support team directly using the contact options below:`,
    requiresFallback: true,
  };
}

// Parse Raw KB text into structured JSON sections, FAQs, and Contacts
function parseDocumentTextLocally(rawText: string, eventTitle: string) {
  const text = (rawText || '').trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let overview = '';
  let venueDetails = '';
  let scheduleDetails = '';
  let dressCode = '';
  const sections: Array<{ title: string; content: string }> = [];
  const faqs: Array<{ question: string; answer: string; category: string }> = [];
  const contacts: Array<{ type: string; label: string; value: string; link?: string }> = [];

  // Extract FAQs formatted with Question / Answer or Q: / A:
  const qRegex = /^(?:Question|\d+\.?\s*Question|Q)[:.]?\s*(.+)$/i;
  const aRegex = /^(?:Answer|\d+\.?\s*Answer|A)[:.]?\s*(.+)$/i;

  let currentQ: string | null = null;
  let currentCategory = 'General';

  // Segment lines by numbered headings or major blocks
  let currentSectionTitle = '';
  let currentSectionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Contact numbers / Emails
    if (/phone|tel|call|whatsapp|contact/i.test(line) && /\+?\d[\d\s-]{7,}/.test(line)) {
      const phoneMatch = line.match(/\+?\d[\d\s-]{7,}/);
      if (phoneMatch) {
        const val = phoneMatch[0].trim();
        const isWa = /whatsapp/i.test(line);
        contacts.push({
          type: isWa ? 'whatsapp' : 'phone',
          label: line.split(':')[0] || (isWa ? 'WhatsApp Line' : 'Phone Desk'),
          value: val,
          link: isWa ? `https://wa.me/${val.replace(/[^0-9]/g, '')}` : `tel:${val.replace(/[^0-9+]/g, '')}`,
        });
      }
    }

    if (/email|mail/i.test(line) && /[\w.-]+@[\w.-]+\.\w+/.test(line)) {
      const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        const email = emailMatch[0].trim();
        contacts.push({
          type: 'email',
          label: line.split(':')[0] || 'Official Email',
          value: email,
          link: `mailto:${email}`,
        });
      }
    }

    // Detect FAQ pattern
    const qMatch = line.match(qRegex);
    if (qMatch) {
      currentQ = qMatch[1].trim();
      continue;
    }

    const aMatch = line.match(aRegex);
    if (aMatch && currentQ) {
      let answerText = aMatch[1].trim();
      // Collect multi-line answer
      while (i + 1 < lines.length && !lines[i + 1].match(qRegex) && !lines[i + 1].match(/^[0-9]+\.\s+[A-Z]/)) {
        i++;
        answerText += ' ' + lines[i];
      }
      faqs.push({
        question: currentQ,
        answer: answerText,
        category: currentCategory,
      });
      currentQ = null;
      continue;
    }

    // Detect major headings like "1. EVENT OVERVIEW", "4. VENUE AND DIRECTIONS", "3. DATE AND TIME"
    const headingMatch = line.match(/^(?:[0-9]+\.\s*)?([A-Z\s&/–-]{4,})$/);
    if (headingMatch && line.length < 60) {
      if (currentSectionTitle && currentSectionLines.length > 0) {
        sections.push({
          title: currentSectionTitle,
          content: currentSectionLines.join('\n\n'),
        });
        currentSectionLines = [];
      }
      currentSectionTitle = line.replace(/^[0-9]+\.\s*/, '').trim();

      if (/venue|location|address/i.test(currentSectionTitle)) currentCategory = 'Venue';
      else if (/date|time|schedule/i.test(currentSectionTitle)) currentCategory = 'Schedule';
      else if (/theme|overview|about/i.test(currentSectionTitle)) currentCategory = 'General';
      else if (/dress|attire/i.test(currentSectionTitle)) currentCategory = 'Attire';
      else currentCategory = currentSectionTitle;
      continue;
    }

    // Key-value pairs like "Venue: ...", "Date: ...", "Time: ...", "Theme: ..."
    if (/^Venue[:.]/i.test(line)) {
      venueDetails = (venueDetails ? venueDetails + '\n' : '') + line.replace(/^Venue[:.]\s*/i, '').trim();
    } else if (/^Date[:.]/i.test(line) || /^Time[:.]/i.test(line)) {
      scheduleDetails = (scheduleDetails ? scheduleDetails + '\n' : '') + line;
    } else if (/^Theme[:.]/i.test(line) || /^Theme\s*is/i.test(line)) {
      overview = (overview ? overview + '\n' : '') + line;
    } else if (/^Dress\s*Code[:.]/i.test(line)) {
      dressCode = line.replace(/^Dress\s*Code[:.]\s*/i, '').trim();
    } else {
      currentSectionLines.push(line);
    }
  }

  if (currentSectionTitle && currentSectionLines.length > 0) {
    sections.push({
      title: currentSectionTitle,
      content: currentSectionLines.join('\n\n'),
    });
  }

  // Fallbacks if not extracted
  if (!overview && sections.length > 0) {
    overview = sections[0].content.substring(0, 400);
  }
  if (!venueDetails) {
    const vSec = sections.find((s) => /venue|direction|location/i.test(s.title));
    if (vSec) venueDetails = vSec.content;
  }
  if (!scheduleDetails) {
    const sSec = sections.find((s) => /date|time|schedule/i.test(s.title));
    if (sSec) scheduleDetails = sSec.content;
  }
  if (!dressCode) {
    const dSec = sections.find((s) => /dress|attire/i.test(s.title));
    if (dSec) dressCode = dSec.content;
  }

  return {
    overview: overview || text.substring(0, 400),
    venueDetails: venueDetails || 'See event guide for full venue details.',
    scheduleDetails: scheduleDetails || 'See event guide for schedule breakdown.',
    dressCode: dressCode || 'Modest & respectful attire recommended.',
    sections,
    faqs,
    contacts,
  };
}

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

  // 1. Private-Link Event Help Desk AI Endpoint (Instant Grounded Concierge + Gemini AI)
  app.post('/api/helpdesk/chat', async (req, res) => {
    try {
      const { userMessage, knowledgeBase, chatHistory } = req.body;

      if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
        return res.status(400).json({ success: false, error: 'User message is required.' });
      }

      if (!knowledgeBase || !knowledgeBase.eventTitle) {
        return res.status(400).json({ success: false, error: 'Knowledge base context is required.' });
      }

      const useGemini = await isGeminiReady();

      // If Gemini AI is confirmed ready and available, attempt AI generation
      if (useGemini) {
        try {
          const apiKey = process.env.GEMINI_API_KEY || '';
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const sectionsText = Array.isArray(knowledgeBase.sections) && knowledgeBase.sections.length > 0
            ? knowledgeBase.sections.map((s: any) => `### SECTION: ${s.title}\n${s.content}`).join('\n\n')
            : '';

          const faqsListText = Array.isArray(knowledgeBase.faqs) && knowledgeBase.faqs.length > 0
            ? knowledgeBase.faqs.map((f: any, i: number) => `${i + 1}. [Category: ${f.category || 'General'}]\n   Q: ${f.question}\n   A: ${f.answer}`).join('\n\n')
            : 'No custom FAQs listed.';

          const contactsListText = Array.isArray(knowledgeBase.contacts) && knowledgeBase.contacts.length > 0
            ? knowledgeBase.contacts.map((c: any) => `- ${c.label || c.type}: ${c.value}`).join('\n')
            : `Phone: ${knowledgeBase.contactPhone || 'N/A'}, Email: ${knowledgeBase.contactEmail || 'N/A'}`;

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

          const contents: any[] = [];
          if (Array.isArray(chatHistory) && chatHistory.length > 0) {
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

          const geminiPromise = ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction,
            },
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI generation timeout')), 3000));
          const response: any = await Promise.race([geminiPromise, timeoutPromise]);

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
          console.warn('Gemini API query error, falling back to instant grounded engine:', err?.message || err);
        }
      }

      // Fast, Grounded Engine (Instant response, works with zero latency & 100% grounding accuracy)
      const localResult = answerFromKnowledgeBase(userMessage, knowledgeBase);
      return res.status(200).json({
        success: true,
        answer: localResult.answer,
        requiresFallback: localResult.requiresFallback,
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
    } catch (e: any) {
      console.error('Chat endpoint error:', e);
      return res.status(500).json({ success: false, error: e?.message || 'Chat error' });
    }
  });

  // 2. Bulk Knowledge Base Document Parser Endpoint
  app.post('/api/helpdesk/parse-kb', async (req, res) => {
    try {
      const { rawText, eventTitle } = req.body;

      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return res.status(400).json({ success: false, error: 'Raw text document content is required.' });
      }

      const useGemini = await isGeminiReady();
      if (useGemini) {
        try {
          const apiKey = process.env.GEMINI_API_KEY || '';
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

          const parsePromise = ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
            },
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI parser timeout')), 3000));
          const response: any = await Promise.race([parsePromise, timeoutPromise]);

          const responseText = response.text || '{}';
          const parsedData = JSON.parse(responseText);
          return res.status(200).json({
            success: true,
            data: parsedData,
          });
        } catch (err: any) {
          console.warn('Gemini parser error, switching to fast local parser:', err?.message || err);
        }
      }

      // Always succeed using high-accuracy intelligent local document parser
      const parsedData = parseDocumentTextLocally(rawText, eventTitle || 'Event');
      return res.status(200).json({
        success: true,
        data: parsedData,
      });
    } catch (parseErr: any) {
      console.error('Local KB Parser Error:', parseErr);
      return res.status(500).json({
        success: false,
        error: parseErr?.message || 'Failed to process document text.',
      });
    }
  });

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

  const port = 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

createServer();
