export type QuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'email'
  | 'phone'
  | 'number'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'date'
  | 'yes_no'
  | 'section_header'
  | 'image_upload';

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: string[]; // For multiple choice, checkboxes, dropdown
  placeholder?: string;
}

export type FormStatus = 'draft' | 'published' | 'closed' | 'archived';

export interface EventForm {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: FormStatus;
  eventDate?: string;
  eventLocation?: string;
  coverImage?: string;
  themeColor: string; // Hex color e.g. #4F46E5
  accentColor: string;
  fontFamily?: string;
  confirmationMessage?: string;
  questions: Question[];
  ownerId: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
  responseCount?: number;
  maxAttendees?: number;
}

export type ResponseStatus = 'confirmed' | 'pending' | 'attended' | 'cancelled';

export interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  formSlug: string;
  reference: string; // e.g. EVT-2026-X7K9
  fullName: string;
  email: string;
  phone?: string;
  answers: Record<string, any>;
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  agentId?: string;
  agentName?: string;
  status: ResponseStatus;
  parent_registration_id?: string; // If set, this is a dependent/additional registrant linked to a main registrant
  createdAt: string;
}

export type UserRole = 'super_admin' | 'admin' | 'agent' | 'event_officer' | 'checkin_officer';

export interface CurrentUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
}

export interface EmailLog {
  id: string;
  subject: string;
  recipientsCount: number;
  successCount?: number;
  failedCount?: number;
  formId?: string;
  formTitle?: string;
  status: 'sent' | 'failed' | 'queued' | 'simulated';
  recipientType: 'all' | 'form_specific' | 'unattended' | 'single';
  recipientEmail?: string;
  errorMessage?: string;
  timestamp: string;
  sender: string;
}

export interface SMTPSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  enabled: boolean;
}

export interface SiteSettings {
  siteName: string;
  siteTagline: string;
  organizationName: string;
  contactEmail: string;
  accentColor: string;
  allowPublicRegistration: boolean;
  enableEmailConfirmations: boolean;
  footerText: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

