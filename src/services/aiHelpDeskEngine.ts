import { EventKnowledgeBase, ContactOption } from '../types';

export interface AIHelpDeskResult {
  answer: string;
  requiresFallback: boolean;
  fallbackDetails: {
    message: string;
    contacts: ContactOption[];
    contactPhone?: string;
    contactEmail?: string;
    whatsappLink?: string;
  };
}

// Client & Server Universal Grounded Q&A Engine (Guarantees zero-downtime on Vercel static & Node servers)
export function answerFromKnowledgeBaseUniversal(
  query: string,
  kb: EventKnowledgeBase
): AIHelpDeskResult {
  const q = (query || '').toLowerCase().trim();
  const cleanQ = q.replace(/[?!.,;:'"()]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleanQ.split(' ').filter((w) => w.length > 2);

  const activeContacts: ContactOption[] = Array.isArray(kb.contacts) && kb.contacts.length > 0
    ? kb.contacts
    : [
        ...(kb.contactPhone ? [{ id: 'ph', type: 'phone' as const, label: 'BSF Help Desk Line', value: kb.contactPhone, link: `tel:${kb.contactPhone.replace(/[^0-9+]/g, '')}` }] : []),
        ...(kb.whatsappLink ? [{ id: 'wa', type: 'whatsapp' as const, label: 'WhatsApp Concierge', value: kb.contactPhone || 'WhatsApp', link: kb.whatsappLink }] : []),
        ...(kb.contactEmail ? [{ id: 'em', type: 'email' as const, label: 'Organizer Email', value: kb.contactEmail, link: `mailto:${kb.contactEmail}` }] : []),
      ];

  const defaultFallbackDetails = {
    message: kb.fallbackMessage || 'For further assistance, our event support team is available via the contact options below:',
    contacts: activeContacts,
    contactPhone: kb.contactPhone,
    contactEmail: kb.contactEmail,
    whatsappLink: kb.whatsappLink,
  };

  // 1. Natural greetings & pleasantries
  const isGreeting = /^(hello|hi|hey|good\s*(morning|afternoon|evening|day)|greetings|howdy|what'?s\s*up|worship\s*culture|blessings|peace)\b/i.test(cleanQ);
  if (isGreeting && tokens.length <= 4) {
    return {
      answer: `Hello! 👋 Welcome to the official **${kb.eventTitle}** Help Desk. I am your 24/7 Event Concierge. You can ask me anything about the theme, venue, schedule, registration, parking, and guidelines! How may I assist you today?`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  const isThanks = /^(thanks|thank\s*you|bless\s*you|god\s*bless\s*you|grateful|much\s*appreciated)\b/i.test(cleanQ);
  if (isThanks) {
    return {
      answer: `You're very welcome! If you have any more questions about **${kb.eventTitle}**, please don't hesitate to ask. God bless you! 🙏`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  const isIdentity = /^(who\s*(are\s*you|made\s*you)|what\s*(are\s*you|is\s*this|can\s*you\s*do))\b/i.test(cleanQ);
  if (isIdentity) {
    return {
      answer: `I am the dedicated Event Concierge for **${kb.eventTitle}**. I'm here to provide accurate details directly from our official event guide—including venue location, timetable, theme insights, dress code, and registration information.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  const faqs = Array.isArray(kb.faqs) ? kb.faqs : [];

  // 2. Search FAQs (High Precision Match)
  let bestFaq: any = null;
  let bestFaqScore = 0;

  for (const faq of faqs) {
    const fq = (faq.question || '').toLowerCase();
    const fAns = (faq.answer || '').toLowerCase();
    let score = 0;

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
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // 3. Search Registration & Fee
  const regTerms = ['register', 'registration', 'fee', 'free', 'cost', 'price', 'ticket', 'pass', 'compulsory', 'pay', 'paid', 'money', 'entry fee'];
  if (regTerms.some((t) => cleanQ.includes(t))) {
    const regFaq = faqs.find((f) => /fee|free|register|ticket|cost/i.test(f.question || ''));
    if (regFaq) return { answer: regFaq.answer, requiresFallback: false, fallbackDetails: defaultFallbackDetails };

    const regSec = (kb.sections || []).find((s) => /reg|ticket|fee|admission|entry/i.test(s.title || ''));
    if (regSec) return { answer: `**${regSec.title}:**\n${regSec.content}`, requiresFallback: false, fallbackDetails: defaultFallbackDetails };

    if (kb.overview && /free|registration/i.test(kb.overview)) {
      return {
        answer: `**Registration & Entry Policy:**\nRegistration for **${kb.eventTitle}** is 100% **FREE**, but **COMPULSORY** for all attendees to secure a seat and digital pass.`,
        requiresFallback: false,
        fallbackDetails: defaultFallbackDetails,
      };
    }
  }

  // 4. Search Organizers
  const orgTerms = ['organizer', 'organiser', 'who organized', 'who is organising', 'who is organizing', 'host', 'bsf', 'baptist student fellowship'];
  if (orgTerms.some((t) => cleanQ.includes(t))) {
    const orgFaq = faqs.find((f) => /organi/i.test(f.question || ''));
    if (orgFaq) return { answer: orgFaq.answer, requiresFallback: false, fallbackDetails: defaultFallbackDetails };

    return {
      answer: `**Event Organiser:**\n**${kb.eventTitle}** is organised by the **Baptist Student Fellowship (BSF)**, Ijeru Baptist Church, Ogbomoso.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // 5. Search Venue, Address, Directions & Plus Code
  const venueTerms = ['venue', 'where', 'location', 'address', 'directions', 'locate', 'church', 'ijeru', 'ogbomoso', 'map', 'plus code', 'navigate', 'driving', 'bus', 'hall', 'arubiewe'];
  if (venueTerms.some((t) => cleanQ.includes(t)) && kb.venueDetails) {
    return {
      answer: `**Venue & Location:**\n${kb.venueDetails}`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // 6. Search Date, Schedule & Door Opening Times
  const scheduleTerms = ['time', 'when', 'date', 'schedule', 'timetable', 'start', 'end', 'hours', 'night', 'doors', 'agenda', 'overnight'];
  if (scheduleTerms.some((t) => cleanQ.includes(t)) && kb.scheduleDetails) {
    return {
      answer: `**Date & Schedule Details:**\n${kb.scheduleDetails}`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // 7. Search Theme & Purpose
  const themeTerms = ['theme', 'about', 'culture', 'meaning', 'worship culture', 'purpose', 'overview', 'concept', 'what is worship', 'lifestyle', 'singing'];
  if (themeTerms.some((t) => cleanQ.includes(t))) {
    const themeSec = (kb.sections || []).find((s) => /theme|worship culture/i.test(s.title || ''));
    if (themeSec) return { answer: `**${themeSec.title}:**\n${themeSec.content}`, requiresFallback: false, fallbackDetails: defaultFallbackDetails };

    if (kb.overview) {
      return {
        answer: `**About & Theme:**\n${kb.overview}`,
        requiresFallback: false,
        fallbackDetails: defaultFallbackDetails,
      };
    }
  }

  // 8. Search Dress Code
  const dressTerms = ['dress', 'code', 'wear', 'attire', 'clothes', 'outfit', 'what to wear', 'guidelines'];
  if (dressTerms.some((t) => cleanQ.includes(t)) && kb.dressCode) {
    return {
      answer: `**Dress Code Guidelines:**\n${kb.dressCode}`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
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
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // 10. Contact Requests
  const contactTerms = ['contact', 'call', 'phone', 'whatsapp', 'email', 'reach', 'talk to someone', 'admin', 'help desk', 'organizer phone', 'support'];
  if (contactTerms.some((t) => cleanQ.includes(t))) {
    return {
      answer: `You can reach our official event team directly through any of the contact channels below:`,
      requiresFallback: true,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // 11. Graceful fallback for unanswerable questions
  return {
    answer: kb.fallbackMessage || `I don't have that specific detail in our event guide right now. Please reach out to our event support team directly using the contact options below:`,
    requiresFallback: true,
    fallbackDetails: defaultFallbackDetails,
  };
}
