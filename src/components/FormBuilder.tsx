import React, { useState, useEffect, useRef } from 'react';
import { EventForm, Question, QuestionType, FormStatus } from '../types';
import { dbService } from '../services/db';
import {
  Save,
  Eye,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Copy,
  ExternalLink,
  Sparkles,
  Check,
  Palette,
  Image as ImageIcon,
  Calendar,
  MapPin,
  Settings,
  HelpCircle,
  Share2,
  Layers,
  Camera,
  Upload,
  Smartphone,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Sliders,
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  List,
  CheckSquare,
  ChevronDown,
  CalendarDays,
  ToggleLeft,
  UserCheck,
  EyeOff,
  Globe
} from 'lucide-react';
import { PublicForm } from './PublicForm';
import { useToast } from '../context/ToastContext';

interface FormBuilderProps {
  initialFormId?: string | null;
  onFormSaved?: (form: EventForm) => void;
  onOpenPublicLink?: (slug: string) => void;
}

const PRESET_BANNERS = [
  {
    name: 'Worship & Praise',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Tech Conference',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Youth Retreat',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Business Seminar',
    url: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Music & Concert',
    url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1600&q=80',
  },
  {
    name: 'Auditorium Hall',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80',
  },
];

const THEME_COLORS = [
  { name: 'Royal Indigo', hex: '#4f46e5' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Deep Violet', hex: '#7c3aed' },
  { name: 'Sunset Amber', hex: '#d97706' },
  { name: 'Crimson Rose', hex: '#e11d48' },
  { name: 'Ocean Cyan', hex: '#0891b2' },
  { name: 'Midnight Slate', hex: '#334155' },
];

const QUESTION_TYPE_INFO: Record<
  QuestionType,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  short_answer: { label: 'Short Answer', icon: Type, description: 'Single-line text (e.g. name, role)' },
  paragraph: { label: 'Paragraph', icon: AlignLeft, description: 'Longer feedback or prayers' },
  email: { label: 'Email', icon: Mail, description: 'Email address with format validation' },
  phone: { label: 'Phone Number', icon: Phone, description: 'Contact / WhatsApp telephone number' },
  number: { label: 'Number', icon: Hash, description: 'Numeric values like age or quantity' },
  multiple_choice: { label: 'Multiple Choice', icon: List, description: 'Single selection from radio pills' },
  checkboxes: { label: 'Checkboxes', icon: CheckSquare, description: 'Multi-select options' },
  dropdown: { label: 'Dropdown', icon: ChevronDown, description: 'Clean selection list' },
  date: { label: 'Date', icon: CalendarDays, description: 'Calendar date picker' },
  yes_no: { label: 'Yes / No', icon: ToggleLeft, description: 'Quick binary decision buttons' },
  image_upload: { label: 'Image Upload', icon: Camera, description: 'Attendee photo, ID, or badge upload' },
  section_header: { label: 'Section Header', icon: Layers, description: 'Visual divider and descriptive header' },
};

export const FormBuilder: React.FC<FormBuilderProps> = ({
  initialFormId,
  onFormSaved,
  onOpenPublicLink,
}) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<EventForm>(() => {
    const targetId =
      initialFormId ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('eventform_editing_form_id') : null) ||
      (typeof window !== 'undefined' && window.location.hash.includes('id=')
        ? window.location.hash.split('id=')[1].split('&')[0]
        : null);

    if (targetId) {
      const existing = dbService.getCachedForm(targetId);
      if (existing) return existing;
    }

    return {
      id: `form-${Date.now()}`,
      slug: `event-${Date.now().toString().slice(-4)}`,
      title: 'Untitled Event Registration',
      description: 'Provide an overview of your event, programme schedule, and attendance guidelines.',
      status: 'draft',
      eventDate: '2026-12-01T10:00',
      eventLocation: 'City Convention Centre, Main Hall',
      coverImage: PRESET_BANNERS[0].url,
      themeColor: '#4f46e5',
      accentColor: '#fbbf24',
      confirmationMessage: 'Thank you for registering! Your delegate pass has been generated.',
      ownerId: 'admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: [
        {
          id: `q-${Date.now()}-1`,
          type: 'short_answer',
          title: 'Full Name',
          placeholder: 'e.g. John Doe',
          required: true,
        },
        {
          id: `q-${Date.now()}-2`,
          type: 'email',
          title: 'Email Address',
          placeholder: 'john@example.com',
          required: true,
        },
        {
          id: `q-${Date.now()}-3`,
          type: 'phone',
          title: 'Phone Number',
          placeholder: '+1 (555) 123-4567',
          required: true,
        },
      ],
    };
  });

  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'settings'>('edit');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('saved');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Warn if navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes to this form. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Load form from database on mount or ID change
  useEffect(() => {
    const formIdToLoad = initialFormId || sessionStorage.getItem('eventform_editing_form_id');
    if (formIdToLoad) {
      setIsLoadingForm(true);
      dbService.getFormBySlug(formIdToLoad).then((found) => {
        if (found) {
          setForm(found);
          setSaveStatus('saved');
          setIsDirty(false);
          setLastSavedTimestamp(new Date(found.updatedAt || Date.now()).toLocaleTimeString());
        }
        setIsLoadingForm(false);
      });
    }
  }, [initialFormId]);

  // Mark form as dirty on edits
  const updateFormState = (updater: (prev: EventForm) => EventForm) => {
    setForm((prev) => {
      const next = updater(prev);
      setIsDirty(true);
      setSaveStatus('dirty');
      return next;
    });
  };

  // Image upload handler supporting both Phone Gallery and Camera
  const processImageFile = (file: File) => {
    // 1. Format validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP)', 'error');
      return;
    }

    // 2. File size validation (up to 12MB)
    if (file.size > 12 * 1024 * 1024) {
      showToast('Image is too large (max 12MB). Please select a smaller photo.', 'error');
      return;
    }

    setUploadingImage(true);
    setUploadProgress(15);

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 50);
        setUploadProgress(15 + percent);
      }
    };

    reader.onload = (event) => {
      setUploadProgress(70);
      const img = new Image();
      img.onload = () => {
        setUploadProgress(85);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          updateFormState((prev) => ({ ...prev, coverImage: compressedDataUrl }));
          setUploadProgress(100);
          showToast('Cover photo uploaded and optimized for cloud persistence!', 'success');
        }
        setTimeout(() => {
          setUploadingImage(false);
          setUploadProgress(0);
        }, 500);
      };

      img.onerror = () => {
        setUploadingImage(false);
        setUploadProgress(0);
        showToast('Unable to process the image file. Please try another image.', 'error');
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setUploadingImage(false);
      setUploadProgress(0);
      showToast('Failed to read image file from device storage.', 'error');
    };

    reader.readAsDataURL(file);
  };

  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Reset input so same file can be selected again if replaced
    e.target.value = '';
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const handleSlugChange = (raw: string) => {
    const slugified = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    updateFormState((prev) => ({ ...prev, slug: slugified }));
  };

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      title: type === 'section_header' ? 'Section Heading' : 'Untitled Question',
      required: type !== 'section_header',
      options: ['multiple_choice', 'checkboxes', 'dropdown'].includes(type)
        ? ['Option 1', 'Option 2', 'Option 3']
        : undefined,
    };

    updateFormState((prev) => ({
      ...prev,
      questions: [...prev.questions, newQ],
    }));
    showToast(`Added ${QUESTION_TYPE_INFO[type]?.label || type} question`, 'info');
  };

  const handleUpdateQuestion = (qId: string, updates: Partial<Question>) => {
    updateFormState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qId ? { ...q, ...updates } : q)),
    }));
  };

  const handleDeleteQuestion = (qId: string) => {
    updateFormState((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== qId),
    }));
    showToast('Question removed from form', 'info');
  };

  const handleDuplicateQuestion = (qId: string) => {
    const qIndex = form.questions.findIndex((q) => q.id === qId);
    if (qIndex < 0) return;
    const targetQ = form.questions[qIndex];
    const duplicatedQ: Question = {
      ...targetQ,
      id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: `${targetQ.title} (Copy)`,
      options: targetQ.options ? [...targetQ.options] : undefined,
    };
    const nextQuestions = [...form.questions];
    nextQuestions.splice(qIndex + 1, 0, duplicatedQ);
    updateFormState((prev) => ({ ...prev, questions: nextQuestions }));
    showToast('Question duplicated', 'info');
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...form.questions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newQuestions.length) return;

    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[targetIdx];
    newQuestions[targetIdx] = temp;

    updateFormState((prev) => ({ ...prev, questions: newQuestions }));
  };

  const handleAddOption = (qId: string) => {
    updateFormState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id === qId) {
          const currentOpts = q.options || [];
          return {
            ...q,
            options: [...currentOpts, `Option ${currentOpts.length + 1}`],
          };
        }
        return q;
      }),
    }));
  };

  const handleUpdateOption = (qId: string, optIndex: number, value: string) => {
    updateFormState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id === qId && q.options) {
          const next = [...q.options];
          next[optIndex] = value;
          return { ...q, options: next };
        }
        return q;
      }),
    }));
  };

  const handleDeleteOption = (qId: string, optIndex: number) => {
    updateFormState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id === qId && q.options) {
          return {
            ...q,
            options: q.options.filter((_, idx) => idx !== optIndex),
          };
        }
        return q;
      }),
    }));
  };

  // Critical persistent save to Cloud Firestore
  const handleSave = async (statusOverride?: FormStatus) => {
    setSaveStatus('saving');
    const toSave: EventForm = {
      ...form,
      status: statusOverride || form.status,
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await dbService.saveForm(toSave);
      setForm(saved);
      setIsDirty(false);
      setSaveStatus('saved');
      const timeStr = new Date().toLocaleTimeString();
      setLastSavedTimestamp(timeStr);
      sessionStorage.setItem('eventform_editing_form_id', saved.id);

      const isPub = (statusOverride || form.status) === 'published';
      showToast(
        isPub ? 'Event form published successfully!' : 'Changes saved successfully!',
        'success'
      );

      if (onFormSaved) {
        onFormSaved(saved);
      }
    } catch (err) {
      console.error('Failed to save form:', err);
      setSaveStatus('error');
      showToast('Could not save form. Please check your connection and retry.', 'error');
    }
  };

  const publicUrl = `${window.location.origin}/#f=${form.slug}`;

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    showToast('Public registration link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (isLoadingForm) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700">Loading form details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Hidden File Inputs for Gallery & Camera */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/jpeg,image/png,image/webp,image/jpg,image/gif"
        onChange={handleGalleryFileSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />

      {/* Top Builder Control Header */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-18 z-30 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full ring-2 ring-white shadow-2xs"
            style={{ backgroundColor: form.themeColor }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight truncate max-w-xs sm:max-w-md">
                {form.title || 'Untitled Form'}
              </h2>
              <span
                className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  form.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : form.status === 'draft'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {form.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span className="font-mono text-indigo-600 font-semibold">/f/{form.slug}</span>
              <span>•</span>
              {/* Save Status Indicator */}
              {saveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-indigo-600 font-bold">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Saving changes...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved {lastSavedTimestamp ? `at ${lastSavedTimestamp}` : 'successfully'}
                </span>
              )}
              {saveStatus === 'dirty' && (
                <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                  <AlertCircle className="w-3.5 h-3.5" /> Save failed (Retry)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Tabs: Questions / Preview / Settings */}
        <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Questions ({form.questions.length})
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            Live Preview
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Theme & Details
          </button>
        </div>

        {/* Action Buttons: Copy Link, Draft, Publish */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyPublicLink}
            title="Copy Public Link"
            className="inline-flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>

          {onOpenPublicLink && (
            <button
              onClick={() => onOpenPublicLink(form.slug)}
              title="Open Public Form in standalone view"
              className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Form</span>
            </button>
          )}

          {form.status === 'published' ? (
            <button
              onClick={() => handleSave('draft')}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Unpublish this form to stop accepting public submissions"
            >
              <EyeOff className="w-3.5 h-3.5 text-amber-600" />
              Unpublish Form
            </button>
          ) : (
            <button
              onClick={() => handleSave('draft')}
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-bold rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-gray-500" />
              Save Draft
            </button>
          )}

          <button
            onClick={() => handleSave('published')}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' && !isDirty ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                {form.status === 'published' ? 'Published' : 'Saved'}
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {form.status === 'published' ? 'Save & Update' : 'Publish Form'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* VIEW: QUESTION EDITOR */}
      {activeTab === 'edit' && (
        <div className="space-y-6">
          {/* Form Header Card (Cover Image + Title & Description) */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Color Accent Bar */}
            <div className="h-3 w-full" style={{ backgroundColor: form.themeColor }} />

            {/* Event Cover Image Area */}
            <div className="relative">
              {form.coverImage ? (
                <div className="h-44 sm:h-64 w-full overflow-hidden relative group">
                  <img
                    src={form.coverImage}
                    alt={form.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-2xs">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="px-3.5 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                      Browse Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-3.5 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFormState((prev) => ({ ...prev, coverImage: undefined }))}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 border-b border-gray-100 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900">Add an Event Cover Banner</h4>
                  <p className="text-xs text-gray-500 max-w-sm mt-0.5 mb-3">
                    Upload an image from your device gallery, snap with your camera, or choose a preset.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Browse Gallery / Files
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      Take Photo (Camera)
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Progress Bar if active */}
              {uploadingImage && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-10">
                  <div className="w-full max-w-xs space-y-2 text-center">
                    <div className="flex justify-between text-xs font-bold text-gray-700">
                      <span>Optimizing & storing image...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">Preparing high-resolution cloud persistent image...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Title and Description Inputs */}
            <div className="p-6 sm:p-8 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Event Form Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormState((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Worship Encounter 3"
                  className="w-full text-2xl sm:text-3xl font-black text-gray-900 border-0 border-b-2 border-transparent focus:border-indigo-600 focus:ring-0 px-0 pb-2 transition placeholder:text-gray-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Event Description & Guidelines
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateFormState((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide an overview of your event, programme schedule, and attendance instructions..."
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition leading-relaxed placeholder:text-gray-300"
                />
              </div>

              {/* Event Metadata Mini Strip */}
              <div className="pt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-gray-200">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{form.eventDate ? new Date(form.eventDate).toLocaleDateString() : 'No date set'}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-gray-200">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span className="truncate max-w-[200px]">{form.eventLocation || 'No venue specified'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 ml-auto cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Edit Schedule & Theme
                </button>
              </div>
            </div>
          </div>

          {/* Questions Container */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                Registration Questions ({form.questions.length})
              </h3>
              <span className="text-xs text-gray-500">
                Use Move Up / Down to reorder questions
              </span>
            </div>

            {form.questions.map((q, index) => {
              const TypeIcon = QUESTION_TYPE_INFO[q.type]?.icon || Type;

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/90 shadow-xs hover:border-gray-300 transition-all space-y-4 relative group"
                >
                  {/* Top Question Row: Index, Title, Field Type Selector */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={q.title}
                        onChange={(e) => handleUpdateQuestion(q.id, { title: e.target.value })}
                        placeholder="Question title"
                        className="text-base font-bold text-gray-900 flex-1 border-0 border-b border-transparent focus:border-indigo-600 focus:ring-0 px-1 py-1 transition"
                      />
                    </div>

                    {/* Question Type Selector Dropdown with Visual Icons */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={q.type}
                          onChange={(e) => handleUpdateQuestion(q.id, { type: e.target.value as QuestionType })}
                          className="pl-8 pr-8 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
                        >
                          {Object.entries(QUESTION_TYPE_INFO).map(([key, info]) => (
                            <option key={key} value={key}>
                              {info.label}
                            </option>
                          ))}
                        </select>
                        <TypeIcon className="w-3.5 h-3.5 text-indigo-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Optional Description / Helper text */}
                  <div>
                    <input
                      type="text"
                      value={q.description || ''}
                      onChange={(e) => handleUpdateQuestion(q.id, { description: e.target.value })}
                      placeholder="Optional description or placeholder helper text..."
                      className="w-full text-xs text-gray-600 border border-gray-100 bg-slate-50/50 rounded-xl px-3 py-2 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>

                  {/* Question Options for Choice, Checkboxes, Dropdown */}
                  {['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type) && (
                    <div className="pl-4 border-l-2 border-indigo-100 space-y-2 py-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Options List:
                      </div>
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(q.id, optIdx, e.target.value)}
                            className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-indigo-500"
                          />
                          {(q.options?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(q.id, optIdx)}
                              className="text-gray-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddOption(q.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Option
                      </button>
                    </div>
                  )}

                  {/* Visual preview for Yes/No */}
                  {q.type === 'yes_no' && (
                    <div className="flex gap-2 text-xs">
                      <span className="px-3 py-1.5 bg-slate-100 text-gray-700 rounded-xl font-semibold">Yes</span>
                      <span className="px-3 py-1.5 bg-slate-100 text-gray-700 rounded-xl font-semibold">No</span>
                    </div>
                  )}

                  {/* Visual preview for image upload question */}
                  {q.type === 'image_upload' && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-3 text-xs text-indigo-900 font-medium">
                      <Camera className="w-5 h-5 text-indigo-600 shrink-0" />
                      <span>Registrants can upload a headshot photo or ID badge directly from phone camera or gallery.</span>
                    </div>
                  )}

                  {/* Question Bottom Action Toolbar */}
                  <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Required Toggle */}
                    {q.type !== 'section_header' ? (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleUpdateQuestion(q.id, { required: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className={`font-bold ${q.required ? 'text-indigo-700' : 'text-gray-500'}`}>
                          {q.required ? 'Required *' : 'Optional'}
                        </span>
                      </label>
                    ) : (
                      <span className="text-[11px] text-gray-400 font-semibold">Section Divider</span>
                    )}

                    {/* Move Up, Move Down, Duplicate, Delete */}
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(index, 'up')}
                        disabled={index === 0}
                        title="Move question up"
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-30 cursor-pointer"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(index, 'down')}
                        disabled={index === form.questions.length - 1}
                        title="Move question down"
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-30 cursor-pointer"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(q.id)}
                        title="Duplicate question"
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Delete question"
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Add Question Panel */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Add Question to Form
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(QUESTION_TYPE_INFO).map(([key, info]) => {
                const Icon = info.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAddQuestion(key as QuestionType)}
                    className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-gray-200 rounded-2xl text-left transition group cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-gray-600 group-hover:text-indigo-600 mb-1.5 transition" />
                    <div className="text-xs font-bold text-gray-800 group-hover:text-indigo-900">
                      {info.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: LIVE PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-900 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Live Preview Mode:</strong> This is how your public attendees will experience your registration form on mobile & desktop.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('edit')}
              className="font-bold underline cursor-pointer text-indigo-700 hover:text-indigo-900 shrink-0 ml-2"
            >
              Return to Editor
            </button>
          </div>
          <PublicForm slugOrId={form.slug} isPreview={true} />
        </div>
      )}

      {/* VIEW: THEME & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* General Details & Event Info */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Event Schedule & Location Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Public URL Slug
                </label>
                <div className="flex rounded-xl shadow-2xs">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs font-mono">
                    /f/
                  </span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 min-w-0 block w-full px-3 py-2 text-xs border border-gray-300 rounded-r-xl focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Form Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => updateFormState((prev) => ({ ...prev, status: e.target.value as FormStatus }))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="draft">Draft (Private)</option>
                  <option value="published">Published (Open for Registration)</option>
                  <option value="closed">Closed (Submissions Disabled)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Event Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={form.eventDate || ''}
                  onChange={(e) => updateFormState((prev) => ({ ...prev, eventDate: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Event Venue / Location
                </label>
                <input
                  type="text"
                  placeholder="Auditorium, Address, or Online Webinar URL"
                  value={form.eventLocation || ''}
                  onChange={(e) => updateFormState((prev) => ({ ...prev, eventLocation: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Custom Post-Registration Confirmation Message
              </label>
              <textarea
                rows={2}
                value={form.confirmationMessage || ''}
                onChange={(e) => updateFormState((prev) => ({ ...prev, confirmationMessage: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Theme & Cover Image Settings */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              Theme Colors & Event Banner
            </h3>

            {/* Color Swatches */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Brand Accent Color
              </label>
              <div className="flex flex-wrap gap-3 items-center">
                {THEME_COLORS.map((tc) => (
                  <button
                    key={tc.hex}
                    type="button"
                    onClick={() => updateFormState((prev) => ({ ...prev, themeColor: tc.hex }))}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition transform cursor-pointer ${
                      form.themeColor === tc.hex ? 'ring-3 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: tc.hex }}
                    title={tc.name}
                  >
                    {form.themeColor === tc.hex && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-gray-500 font-mono">Hex:</span>
                  <input
                    type="color"
                    value={form.themeColor}
                    onChange={(e) => updateFormState((prev) => ({ ...prev, themeColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0"
                  />
                </div>
              </div>
            </div>

            {/* Cover Image Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-700">
                  Event Cover Banner Image
                </label>
                {form.coverImage && (
                  <button
                    type="button"
                    onClick={() => updateFormState((prev) => ({ ...prev, coverImage: undefined }))}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Remove Picture
                  </button>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                  Select from Gallery / Device Files
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-indigo-600" />
                  Take Picture (Camera)
                </button>
              </div>

              {/* Preset Gallery */}
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Or Select from Curated Gallery:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {PRESET_BANNERS.map((banner, bIdx) => (
                  <div
                    key={bIdx}
                    onClick={() => updateFormState((prev) => ({ ...prev, coverImage: banner.url }))}
                    className={`h-20 rounded-2xl overflow-hidden relative cursor-pointer border-2 transition ${
                      form.coverImage === banner.url ? 'border-indigo-600 ring-2 ring-indigo-500' : 'border-gray-200 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={banner.url} alt={banner.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                      <span className="text-[10px] font-bold text-white truncate">{banner.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Image URL input */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Or Paste Custom Image URL:
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={form.coverImage || ''}
                  onChange={(e) => updateFormState((prev) => ({ ...prev, coverImage: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
