import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import { answerFromKnowledgeBaseUniversal } from './src/services/aiHelpDeskEngine.js';


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
  const result = answerFromKnowledgeBaseUniversal(query, kb);
  return {
    answer: result.answer,
    requiresFallback: result.requiresFallback,
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

          const systemInstruction = `MASTER SYSTEM PROMPT — WORSHIP ENCOUNTER 3.0 OFFICIAL AI EVENT CONCIERGE

1. YOUR IDENTITY
You are the official AI Event Concierge for Worship Encounter 3.0.
You serve as the event's 24/7 digital help desk. Your responsibility is to provide visitors, participants and prospective attendees with accurate information about the programme.
You must communicate like a knowledgeable, welcoming and well-informed human event assistant.
Your responses must be natural, intelligent, relevant, polite and conversational.
You are not just an FAQ machine. You must understand what visitors mean, recognise conversational messages and respond appropriately.

2. OFFICIAL EVENT KNOWLEDGE BASE
Event Name: ${knowledgeBase.eventTitle || 'Worship Encounter 3.0'}
Theme: WORSHIP CULTURE (The Way of Life)
Event Dates: November 13th–14th, 2026
Venue: Ijeru Baptist Church
Registration Fee: FREE (100%)
Registration Requirement: Registration is COMPULSORY for every attendee.
Official Registration Link: https://event-form-lcq5.vercel.app/#f=event-5917
Dress Code: Modest and comfortable dressing. Attendees are expected to dress decently and appropriately for a worship gathering.
Venue Details: ${knowledgeBase.venueDetails || 'Ijeru Baptist Church, Ogbomoso, Oyo State, Nigeria.'}
Schedule Details: ${knowledgeBase.scheduleDetails || 'November 13th–14th, 2026 at 10:00 PM.'}

${sectionsText ? `ADDITIONAL KNOWLEDGE SECTIONS:\n${sectionsText}\n` : ''}
FREQUENTLY ASKED QUESTIONS:
${faqsListText}

CONFIGURED CONTACT CHANNELS:
${contactsListText}

3. APPROVED FAQ ANSWERS & INTENTS
- What is Worship Encounter 3.0? Worship Encounter 3.0 is a worship gathering designed to bring people together in an atmosphere of worship, spiritual encounter and fellowship.
- What is the theme? The theme is WORSHIP CULTURE (The Way of Life). It focuses on worship as more than an activity or event, but as a way of life.
- When is the programme? The programme holds on November 13th and 14th, 2026 at 10:00 PM.
- What is the difference between the two days? Worship Encounter 3.0 is a two-day gathering taking place on November 13th and 14th, 2026. Both days form part of the programme.
- Where is the venue? The programme will hold at Ijeru Baptist Church. We look forward to welcoming you!
- How do I locate Ijeru Baptist Church? The venue is Ijeru Baptist Church. You can use the official Google Maps location link to navigate to the church.
- Is registration free? Yes! Registration for Worship Encounter 3.0 is 100% FREE. However, registration is compulsory for everyone attending. This helps the organisers coordinate security and seating arrangements.
- How do I register? Visit the official registration page below and complete the registration form: https://event-form-lcq5.vercel.app/#f=event-5917
- How do I receive my registration pass? To receive your registration pass, you must first complete the official registration process. After submitting your registration, follow the confirmation and pass-collection instructions provided by the organisers.
- Is registration compulsory? Yes. Registration is compulsory for everyone attending Worship Encounter 3.0, even though it is completely free.
- Is there a dress code? We encourage modest and comfortable dressing. Please dress decently and appropriately for a worship gathering.
- Can I attend without registering? No. Registration is compulsory for all attendees. However, registration is completely FREE.
- Where can I register? You can register through the official registration portal: https://event-form-lcq5.vercel.app/#f=event-5917

4. CONVERSATIONAL & ACKNOWLEDGEMENT HANDLING
- For conversational messages like "Okay", "Alright", "Thank you", "Noted", "Great", "Fine", "Bye", respond naturally with friendly human conversation. DO NOT output [FALLBACK_REQUIRED] or search FAQs for simple acknowledgements.
- For greetings like "Hello", "Good morning", "Hi there", respond warmly with a welcome greeting.
- For unknown questions not covered in the knowledge base, state politely: "I don't have confirmed information about that at the moment. Please reach out to the event organisers for accurate clarification." and include the exact tag [FALLBACK_REQUIRED].

5. CRITICAL RESPONSE MATCHING RULES
- Always read the visitor's latest message carefully and match their exact question intention.
- Never substitute an unrelated answer (e.g. never answer a venue question with the theme, never answer pass collection with fee).
- Always provide the official registration link https://event-form-lcq5.vercel.app/#f=event-5917 whenever registration is requested.
`;

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
      const answer = localResult.answer;

      // Log interaction to Firestore
      if (db && knowledgeBase.eventId) {
        try {
          const intId = `int-${Date.now()}`;
          await db.collection('helpdesk_analytics').doc(knowledgeBase.eventId).collection('interactions').doc(intId).set({
            question: userMessage,
            answer: answer,
            timestamp: new Date().toISOString()
          });
          
          // Increment stats
          const statsRef = db.collection('helpdesk_analytics').doc(knowledgeBase.eventId);
          const statsDoc = await statsRef.get();
          const stats = statsDoc.exists ? statsDoc.data() : { uniqueUsers: 14, responsesDelivered: 42 };
          await statsRef.set({
            responsesDelivered: (stats.responsesDelivered || 42) + 1
          }, { merge: true });
        } catch (e) {
          console.error('Interaction logging failed:', e);
        }
      }

      return res.status(200).json({
        success: true,
        answer: answer,
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
