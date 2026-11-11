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

export const OFFICIAL_REGISTRATION_LINK = 'https://event-form-lcq5.vercel.app/#f=event-5917';

// Intelligent & Grounded Q&A Engine following Master System Prompt and prioritizing Admin-saved FAQs
export function answerFromKnowledgeBaseUniversal(
  query: string,
  kb: EventKnowledgeBase
): AIHelpDeskResult {
  const q = (query || '').trim();
  const cleanQ = q.toLowerCase().replace(/[?!.,;:'"()]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = cleanQ.split(' ').filter((w) => w.length >= 2);

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

  // ==========================================
  // STEP 1: CONVERSATIONAL ACKNOWLEDGEMENT & GREETINGS
  // ==========================================
  if (/^(okay|ok|alright|all\s*right)\b/i.test(cleanQ) && tokens.length <= 3) {
    return {
      answer: `Alright! Let me know if you need any further information about Worship Encounter 3.0. I'm happy to help.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(thank\s*you|thanks|grateful|much\s*appreciated)\b/i.test(cleanQ)) {
    return {
      answer: `You're very welcome! We're glad to have you. See you at Worship Encounter 3.0!`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(noted|understood|i\s*see)\b/i.test(cleanQ) && tokens.length <= 3) {
    return {
      answer: `Wonderful! Don't forget to complete your free registration before the programme if you haven't already.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(that'?s\s*fine|fine|no\s*problem|cool)\b/i.test(cleanQ) && tokens.length <= 3) {
    return {
      answer: `Alright! Feel free to reach out whenever you need assistance.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(great|nice|wonderful|perfect)\b/i.test(cleanQ) && tokens.length <= 3) {
    return {
      answer: `Glad to hear that! Looking forward to seeing you at the programme.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(bye|goodbye|see\s*you)\b/i.test(cleanQ) && tokens.length <= 3) {
    return {
      answer: `Goodbye! Have a wonderful day. We look forward to seeing you at Worship Encounter 3.0.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^good\s*morning\b/i.test(cleanQ) && tokens.length <= 4) {
    return {
      answer: `Good morning! You're welcome to Worship Encounter 3.0's official Help Desk. What would you like to know about the programme?`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^good\s*(afternoon|evening|day)\b/i.test(cleanQ) && tokens.length <= 4) {
    return {
      answer: `Welcome to Worship Encounter 3.0's official Help Desk! How can I assist you with the programme today?`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(hello|hi|hi\s*there|hey|greetings|howdy)\b/i.test(cleanQ) && tokens.length <= 3) {
    return {
      answer: `Hello! Welcome to the official Worship Encounter 3.0 Help Desk. How can I assist you today?`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  if (/^(who\s*(are\s*you|made\s*you)|what\s*(are\s*you|is\s*this|can\s*you\s*do))\b/i.test(cleanQ)) {
    return {
      answer: `I am the official AI Event Concierge for Worship Encounter 3.0. I'm here to provide accurate details directly from our official event guide—including venue location, timetable, theme insights, dress code, and registration information.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // ==========================================
  // STEP 2: SEARCH ADMIN-SAVED FAQS FIRST (HIGHEST PRIORITY)
  // ==========================================
  const faqs = Array.isArray(kb.faqs) ? kb.faqs : [];
  let bestFaq: any = null;
  let bestFaqScore = 0;

  for (const faq of faqs) {
    const fq = (faq.question || '').toLowerCase().replace(/[?!.,;:'"()]/g, ' ').trim();
    const fAns = (faq.answer || '').toLowerCase();
    let score = 0;

    // Exact question or subphrase match
    if (fq === cleanQ) score += 20;
    else if (cleanQ.includes(fq) || fq.includes(cleanQ)) score += 12;

    for (const t of tokens) {
      if (fq.includes(t)) score += 4;
      else if (fAns.includes(t)) score += 1;
    }

    if (score > bestFaqScore) {
      bestFaqScore = score;
      bestFaq = faq;
    }
  }

  // If a saved FAQ matches with confidence, return the EXACT saved answer
  if (bestFaq && bestFaqScore >= 1) {
    return {
      answer: bestFaq.answer,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // ==========================================
  // STEP 3: SEARCH ADMIN CUSTOM KNOWLEDGE SECTIONS
  // ==========================================
  const sections = Array.isArray(kb.sections) ? kb.sections : [];
  for (const sec of sections) {
    const sTitle = (sec.title || '').toLowerCase();
    const sContent = (sec.content || '').toLowerCase();
    let secScore = 0;

    if (cleanQ.includes(sTitle) || sTitle.includes(cleanQ)) secScore += 10;
    for (const t of tokens) {
      if (sTitle.includes(t)) secScore += 3;
      if (sContent.includes(t)) secScore += 2;
    }

    if (secScore >= 1) {
      return {
        answer: `**${sec.title}:**\n${sec.content}`,
        requiresFallback: false,
        fallbackDetails: defaultFallbackDetails,
      };
    }
  }

  // ==========================================
  // STEP 4: REASONING & INTENT MATCHING ON OFFICIAL EVENT FACTS
  // ==========================================

  // INTENT A: REGISTRATION PASS / TICKET COLLECTION
  if (/(pass|ticket|badge|collect|receive\s*my|get\s*my\s*pass)/i.test(cleanQ)) {
    return {
      answer: `To receive your registration pass, you must first complete the official registration process.\n\nAfter submitting your registration on the portal, follow the confirmation and pass-collection instructions provided by the organisers.\n\nRegistration portal: [${OFFICIAL_REGISTRATION_LINK}](${OFFICIAL_REGISTRATION_LINK})\n\nIf you need further assistance with your pass, feel free to contact the event organisers.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT B: HOW TO REGISTER / SIGN UP / FORM LINK
  if (/(how\s*do\s*i\s*register|how\s*to\s*register|where\s*can\s*i\s*register|where\s*to\s*register|registration\s*link|sign\s*up|portal|how\s*can\s*i\s*sign\s*up|where\s*is\s*the\s*registration)/i.test(cleanQ)) {
    return {
      answer: `Registration is simple and completely FREE.\n\nVisit the official registration page below and complete the registration form:\n\n👉 [${OFFICIAL_REGISTRATION_LINK}](${OFFICIAL_REGISTRATION_LINK})\n\nRemember, registration is compulsory for everyone attending.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT C: COST / MONEY / FEE / PRICE / PAY / IS IT FREE
  if (/(money|pay|fee|cost|price|is\s*it\s*free|registration\s*free|do\s*i\s*need\s*money|ticket\s*fee|entry\s*fee|do\s*i\s*need\s*to\s*pay|how\s*much)/i.test(cleanQ)) {
    return {
      answer: `Yes! Registration for Worship Encounter 3.0 is 100% FREE.\n\nYou do not need money to register or attend. However, registration is compulsory for everyone attending to help the organisers coordinate security and seating arrangements.\n\nRegister free here: [${OFFICIAL_REGISTRATION_LINK}](${OFFICIAL_REGISTRATION_LINK})`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT D: IS REGISTRATION COMPULSORY / ATTEND WITHOUT REGISTERING
  if (/(compulsory|attend\s*without|mandatory|must\s*i\s*register)/i.test(cleanQ)) {
    return {
      answer: `Yes, registration is compulsory for everyone attending Worship Encounter 3.0, even though it is completely FREE.\n\nNo, attendees cannot enter without registering. Please use the official registration link to secure your registration:\n\n👉 [${OFFICIAL_REGISTRATION_LINK}](${OFFICIAL_REGISTRATION_LINK})`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT E: DRESS CODE / WHAT TO WEAR / CLOTHES / ATTIRE
  if (/(dress|wear|attire|clothes|outfit|what\s*to\s*wear|dress\s*code)/i.test(cleanQ)) {
    return {
      answer: `We encourage modest and comfortable dressing.\n\nPlease dress decently and appropriately for a worship gathering. Come prepared and comfortable.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT F: VENUE / LOCATION / WHERE IS IT HOLDING / WHICH CHURCH
  if (/(where|venue|location|address|church|holding|having\s*the\s*event|which\s*church)/i.test(cleanQ) && !cleanQ.includes('locate') && !cleanQ.includes('direction') && !cleanQ.includes('get there') && !cleanQ.includes('map')) {
    return {
      answer: `The programme will hold at Ijeru Baptist Church, Ogbomoso.\n\nWe look forward to welcoming you!`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT G: DIRECTIONS / MAP / LOCATE / HOW TO GET THERE
  if (/(locate|direction|directions|get\s*there|map|navigate|plus\s*code|arubiewe)/i.test(cleanQ)) {
    if (kb.venueDetails && kb.venueDetails.includes('http')) {
      return {
        answer: `The venue is Ijeru Baptist Church.\n\nYou can use the official Google Maps location link to navigate directly to the church:\n\n${kb.venueDetails}`,
        requiresFallback: false,
        fallbackDetails: defaultFallbackDetails,
      };
    }
    return {
      answer: `The venue is Ijeru Baptist Church, Ogbomoso, Oyo State, Nigeria.\n\nYou can navigate using Google Maps to Ijeru Baptist Church, Ogbomoso.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT H: THEME / TOPIC / WORSHIP CULTURE / WHAT IS IT ABOUT
  if (/(theme|topic|worship\s*culture|what\s*is\s*worship\s*encounter|about|concept|what\s*is\s*the\s*programme)/i.test(cleanQ)) {
    return {
      answer: `The theme of Worship Encounter 3.0 is WORSHIP CULTURE (The Way of Life).\n\nIt focuses on worship as more than an activity or event, but as a way of life. Worship Encounter 3.0 is a worship gathering designed to bring people together in an atmosphere of worship, spiritual encounter and fellowship.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // INTENT I: DATES / WHEN / TIME / SCHEDULE / DIFFERENCE BETWEEN DAYS
  if (/(when|date|dates|time|schedule|night|days|difference|13th|14th|november)/i.test(cleanQ)) {
    if (cleanQ.includes('difference') || cleanQ.includes('two days') || cleanQ.includes('both days')) {
      return {
        answer: `Worship Encounter 3.0 is a two-day gathering taking place on November 13th and 14th, 2026.\n\nBoth days form part of the programme. For specific session descriptions and timings, refer to the official programme schedule supplied by the organisers.`,
        requiresFallback: false,
        fallbackDetails: defaultFallbackDetails,
      };
    }
    return {
      answer: `The programme holds on November 13th and 14th, 2026 at 10:00 PM.`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // Contact Requests
  if (/(contact|call|phone|whatsapp|email|reach|talk\s*to\s*someone|support|organizer)/i.test(cleanQ)) {
    return {
      answer: `You can reach the event organisers directly through the official contact channels below:`,
      requiresFallback: true,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // ==========================================
  // STEP 5: UNRELATED QUESTION REDIRECT
  // ==========================================
  const unrelatedTerms = ['weather', 'capital', 'president', 'recipe', 'football', 'soccer', 'movie', 'crypto', 'bitcoin'];
  if (unrelatedTerms.some((t) => cleanQ.includes(t))) {
    return {
      answer: `I am specialized as the Event Concierge for Worship Encounter 3.0. Please feel free to ask me anything about Worship Encounter 3.0's theme, venue, schedule, registration, or guidelines!`,
      requiresFallback: false,
      fallbackDetails: defaultFallbackDetails,
    };
  }

  // ==========================================
  // STEP 6: UNKNOWN / UNCONFIRMED EVENT DETAILS
  // ==========================================
  return {
    answer: `I don't have confirmed information about that at the moment. Please reach out to the event organisers for accurate clarification.`,
    requiresFallback: true,
    fallbackDetails: defaultFallbackDetails,
  };
}
