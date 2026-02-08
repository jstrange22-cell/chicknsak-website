import type { Timestamp } from 'firebase/firestore';

// Base type with common fields
interface BaseDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Company
export interface Company extends BaseDocument {
  name: string;
  slug: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  settings: Record<string, unknown>;
  subscriptionPlan?: string;
}

// User roles
export type UserRole = 'admin' | 'manager' | 'standard' | 'limited';

// User
export interface User extends BaseDocument {
  companyId?: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  role: UserRole;
  jobTitle?: string;
  isActive: boolean;
  notificationSettings: NotificationSettings;
  settings: Record<string, unknown>;
}


export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  photoUploads: boolean;
  comments: boolean;
  mentions: boolean;
  taskAssignments: boolean;
}

// Invitation system
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation extends BaseDocument {
  companyId: string;
  companyName: string;
  email: string;
  fullName: string;
  role: UserRole;
  invitedBy: string;
  status: InvitationStatus;
  inviteToken: string;
  acceptedAt?: Timestamp;
  acceptedByUid?: string;
}

// Project status
export type ProjectStatus = 'active' | 'completed' | 'archived' | 'on_hold' | 'lead';

// Project types
export type ProjectType = 
  | 'deck' 
  | 'remodel' 
  | 'new_construction' 
  | 'repair' 
  | 'inspection' 
  | 'real_estate'
  | 'other';

// Project
export interface Project extends BaseDocument {
  companyId: string;
  name: string;
  description?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressFull?: string;
  latitude?: number;
  longitude?: number;
  status: ProjectStatus;
  projectType?: ProjectType;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCompany?: string;
  notepad?: string;
  coverPhotoId?: string;
  progress: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  completedAt?: Timestamp;
  archivedAt?: Timestamp;
  geofence?: Geofence;
}

// Label groups
export type LabelGroup = 'status' | 'type' | 'source' | 'priority' | 'custom';

// Label
export interface Label extends BaseDocument {
  companyId: string;
  name: string;
  color: string;
  labelGroup?: LabelGroup;
  sortOrder: number;
}


// Photo types
export type PhotoType = 'standard' | 'before' | 'after' | 'internal';

// Photo
export interface Photo extends BaseDocument {
  projectId: string;
  companyId: string;
  uploadedBy: string;
  storagePath: string;
  thumbnailPath?: string;
  url: string;
  thumbnailUrl?: string;
  annotatedUrl?: string;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  capturedAt: Timestamp;
  photoType: PhotoType;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  mimeType: string;
  aiCaption?: string;
  aiAnalysis?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// Tag
export interface Tag extends BaseDocument {
  companyId: string;
  name: string;
  color: string;
  sortOrder: number;
}

// PhotoTag - junction table for photo-tag relationships
export interface PhotoTag extends BaseDocument {
  photoId: string;
  tagId: string;
}

// Annotation
export interface Annotation extends BaseDocument {
  photoId: string;
  userId: string;
  annotationData: AnnotationData;
  annotatedImageUrl?: string;
}

export interface AnnotationData {
  shapes: AnnotationShape[];
  version: number;
}

export interface AnnotationShape {
  id: string;
  type: 'arrow' | 'rectangle' | 'circle' | 'text' | 'freehand' | 'pen' | 'line';
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
  text?: string;
}


// Comment
export interface Comment extends BaseDocument {
  companyId: string;
  userId: string;
  projectId: string;
  photoId?: string;
  body: string;
  mentions: string[];
  voiceNoteUrl?: string;
  parentCommentId?: string;
}

// ============================================================
// CHECKLIST TEMPLATES
// ============================================================

export type ChecklistFieldType =
  | 'checkbox'
  | 'photo_required'
  | 'yes_no'
  | 'rating'
  | 'multiple_choice'
  | 'text'
  | 'signature'
  | 'date'
  | 'number';

export type ChecklistCategory = 'inspection' | 'installation' | 'safety' | 'quality' | 'custom';

export interface TemplateField {
  id: string;
  label: string;
  type: ChecklistFieldType;
  required: boolean;
  options?: string[]; // for multiple_choice
  unit?: string; // for number fields
}

export interface TemplateSection {
  name: string;
  fields: TemplateField[];
}

export interface ChecklistTemplate extends BaseDocument {
  companyId: string;
  name: string;
  description?: string;
  category: ChecklistCategory;
  sections: TemplateSection[];
  createdBy: string;
  isActive: boolean;
}

// ============================================================
// CHECKLISTS (instances from templates or custom)
// ============================================================

export type ChecklistStatus = 'in_progress' | 'completed';

export interface Checklist extends BaseDocument {
  projectId: string;
  companyId: string;
  templateId?: string;
  name: string;
  status: ChecklistStatus;
  assignedTo?: string;
  sections: TemplateSection[];
  completedAt?: Timestamp;
  completedBy?: string;
  createdBy: string;
}

// ============================================================
// CHECKLIST ITEMS (denormalized for per-item queries)
// ============================================================

export interface ChecklistItem extends BaseDocument {
  checklistId: string;
  sectionName?: string;
  label: string;
  fieldType: ChecklistFieldType;
  sortOrder: number;
  completed: boolean;
  completedAt?: Timestamp;
  completedBy?: string;
  value?: string;
  photoIds: string[];
  notes?: string;
  required: boolean;
  options?: string[];
}

// ============================================================
// TASKS
// ============================================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task extends BaseDocument {
  projectId: string;
  photoId?: string;
  companyId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string; // ISO date string
  completedAt?: Timestamp;
  completedBy?: string;
  createdBy: string;
}

// ============================================================
// DOCUMENTS
// ============================================================

export interface ProjectDocument extends BaseDocument {
  projectId: string;
  companyId: string;
  userId: string;
  name: string;
  storagePath: string;
  url: string;
  fileType?: string;
  fileSizeBytes?: number;
  description?: string;
  metadata: Record<string, unknown>;
}

// ============================================================
// PAGES (Collaborative documents)
// ============================================================

export type PageType = 'general' | 'walkthrough_note' | 'progress_recap' | 'daily_log' | 'ai_summary' | 'proposal';

export interface Page extends BaseDocument {
  projectId: string;
  companyId: string;
  title: string;
  content: Record<string, unknown>; // TipTap JSON
  pageType: PageType;
  photoIds: string[];
  pdfUrl?: string;
  shareLink?: string;
  shareToken: string;
  createdBy: string;
}

// ============================================================
// REPORTS (Photo reports with PDF export)
// ============================================================

export type ReportType = 'photo' | 'inspection' | 'insurance' | 'progress' | 'custom';
export type ReportStatus = 'draft' | 'published';
export type ReportLayout = 'grid' | 'single' | 'side-by-side';

export interface ReportSection {
  id: string;
  title: string;
  photoIds: string[];
  notes: string;
  layout: ReportLayout;
}

export interface Report extends BaseDocument {
  projectId: string;
  companyId: string;
  name: string;
  reportType: ReportType;
  coverTitle?: string;
  includeLogo: boolean;
  sections: ReportSection[];
  pdfUrl?: string;
  shareLink?: string;
  shareToken: string;
  status: ReportStatus;
  createdBy: string;
}

export interface ReportTemplate extends BaseDocument {
  companyId: string;
  name: string;
  reportType?: ReportType;
  sectionsTemplate: ReportSection[];
  createdBy: string;
}

// ============================================================
// GALLERIES
// ============================================================

export interface Gallery extends BaseDocument {
  projectId: string;
  companyId: string;
  name: string;
  description?: string;
  photoIds: string[];
  shareToken: string;
  isActive: boolean;
  passwordHash?: string;
  createdBy: string;
}

// ============================================================
// TIMELINES
// ============================================================

export interface Timeline extends BaseDocument {
  projectId: string;
  companyId: string;
  shareToken: string;
  isActive: boolean;
  allowComments: boolean;
  passwordHash?: string;
  createdBy: string;
}

// ============================================================
// COLLABORATORS (external guests)
// ============================================================

export type CollaboratorRole = 'viewer' | 'contributor' | 'subcontractor';

export interface CollaboratorPermissions {
  viewPhotos: boolean;
  addPhotos: boolean;
  addComments: boolean;
}

export interface Collaborator extends BaseDocument {
  projectId: string;
  companyId: string;
  email: string;
  name?: string;
  phone?: string;
  role: CollaboratorRole;
  accessToken: string;
  permissions: CollaboratorPermissions;
  invitedBy: string;
  acceptedAt?: Timestamp;
  expiresAt?: Timestamp;
}

// ============================================================
// USER GROUPS
// ============================================================

export interface UserGroup extends BaseDocument {
  companyId: string;
  name: string;
  description?: string;
  memberIds: string[];
  createdBy: string;
}

// Activity types
export type ActivityType =
  | 'photo_uploaded'
  | 'photo_annotated'
  | 'photo_deleted'
  | 'project_created'
  | 'project_updated'
  | 'project_completed'
  | 'comment_added'
  | 'user_joined'
  | 'task_created'
  | 'task_completed'
  | 'checklist_created'
  | 'checklist_completed'
  | 'document_uploaded'
  | 'document_deleted'
  | 'report_created'
  | 'report_published'
  | 'page_created'
  | 'gallery_created'
  | 'collaborator_invited';

// Activity Log Entry
export interface ActivityLogEntry extends BaseDocument {
  companyId: string;
  projectId?: string;
  userId: string;
  activityType: ActivityType;
  message: string;
  entityType?: string;
  entityId?: string;
  thumbnailUrl?: string;
  metadata: Record<string, unknown>;
}

// Notification types
export type NotificationType =
  | 'mention'
  | 'comment'
  | 'photo_upload'
  | 'task_assigned'
  | 'task_completed'
  | 'checklist_assigned'
  | 'checklist_completed'
  | 'project_update'
  | 'system';

// Notification
export interface Notification extends BaseDocument {
  userId: string;
  companyId: string;
  title: string;
  body?: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
}

// ============================================================
// LOCATION TRACKING
// ============================================================

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Timestamp;
  speed?: number;
}

export interface Geofence {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isEnabled: boolean;
}

// ============================================================
// TIME ENTRIES
// ============================================================

export type TimeEntryStatus = 'active' | 'completed' | 'approved' | 'rejected';

export interface TimeEntry extends BaseDocument {
  companyId: string;
  userId: string;
  projectId?: string;
  clockInTime: Timestamp;
  clockOutTime?: Timestamp;
  durationMinutes?: number;
  clockInLatitude?: number;
  clockInLongitude?: number;
  clockOutLatitude?: number;
  clockOutLongitude?: number;
  notes?: string;
  breakMinutes: number;
  isManualEntry: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  status: TimeEntryStatus;
  locationTrackingEnabled?: boolean;
}

// ============================================================
// TIME-OFF REQUESTS
// ============================================================

export type TimeOffRequestStatus = 'pending' | 'approved' | 'denied';
export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'unpaid' | 'other';

export interface TimeOffRequest extends BaseDocument {
  companyId: string;
  userId: string;
  type: TimeOffType;
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  reason: string;
  status: TimeOffRequestStatus;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNote?: string;
}

// ============================================================
// MESSAGING
// ============================================================

export type ChannelType = 'group' | 'direct' | 'project';

export interface Channel extends BaseDocument {
  companyId: string;
  name: string;
  description?: string;
  channelType: ChannelType;
  projectId?: string;
  isArchived: boolean;
  createdBy: string;
  typingUsers?: Record<string, Timestamp>;
}

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: string;
  lastReadAt: Timestamp;
  joinedAt: Timestamp;
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'audio';
  url: string;
  name: string;
  size?: number;
  thumbnailUrl?: string;
  duration?: number; // audio duration in seconds
}

export interface Message extends BaseDocument {
  channelId: string;
  userId: string;
  body: string;
  attachments: MessageAttachment[];
  mentions: string[];
  parentMessageId?: string;
  isEdited: boolean;
  reactions?: Record<string, string[]>;
  readBy?: string[];
  // Pinned messages
  isPinned?: boolean;
  pinnedAt?: Timestamp;
  pinnedBy?: string;
  // Voice messages
  isVoiceMessage?: boolean;
  audioDuration?: number; // seconds
  // Scheduled messages
  scheduledAt?: Timestamp;
  isScheduled?: boolean;
}

// ============================================================
// SIGNATURES
// ============================================================

export type SignatureStatus = 'pending' | 'signed' | 'declined' | 'expired';

export interface Signature extends BaseDocument {
  projectId: string;
  companyId: string;
  documentId?: string;
  signerName: string;
  signerEmail?: string;
  signatureData?: string; // base64 SVG/PNG
  signedAt?: Timestamp;
  ipAddress?: string;
  status: SignatureStatus;
  shareToken: string;
  createdBy: string;
}

// ============================================================
// PAYMENT REQUESTS
// ============================================================

export type PaymentStatus = 'pending' | 'sent' | 'paid' | 'declined' | 'refunded';

export interface PaymentLineItem {
  description: string;
  amount: number; // cents
  quantity: number;
}

export interface PaymentRequest extends BaseDocument {
  projectId: string;
  companyId: string;
  amountCents: number;
  currency: string;
  description?: string;
  lineItems: PaymentLineItem[];
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  stripeCheckoutUrl?: string;
  shareToken: string;
  paidAt?: Timestamp;
  createdBy: string;
}

// ============================================================
// INTEGRATIONS
// ============================================================

export type IntegrationProvider = 'jobtread' | 'zapier' | 'quickbooks' | 'google_drive';

export interface Integration extends BaseDocument {
  companyId: string;
  provider: IntegrationProvider;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Timestamp;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncedAt?: Timestamp;
}

export type SyncAction = 'create' | 'update' | 'delete' | 'sync_to_jobtread' | 'sync_from_jobtread';
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SyncQueueItem extends BaseDocument {
  companyId: string;
  entityType: string;
  entityId?: string;
  action: SyncAction;
  provider: IntegrationProvider;
  payload?: Record<string, unknown>;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  processedAt?: Timestamp;
}

// ============================================================
// SHOWCASES & MARKETING
// ============================================================

export interface Showcase extends BaseDocument {
  companyId: string;
  projectId: string;
  title: string;
  description?: string;
  beforePhotoId?: string;
  afterPhotoId?: string;
  galleryPhotoIds: string[];
  isPublished: boolean;
  slug?: string;
}

export type ReviewPlatform = 'google' | 'yelp' | 'facebook' | 'bbb' | 'houzz';
export type ReviewRequestStatus = 'draft' | 'sent' | 'clicked' | 'completed';

export interface ReviewRequest extends BaseDocument {
  projectId: string;
  companyId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  platform?: ReviewPlatform;
  reviewLink?: string;
  message?: string;
  status: ReviewRequestStatus;
  sentAt?: Timestamp;
  createdBy: string;
}

// ============================================================
// INVOICES
// ============================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  description: string;
  amount: number; // cents
  quantity: number;
}

export interface Invoice extends BaseDocument {
  companyId: string;
  projectId?: string;
  customerName: string;
  customerEmail?: string;
  lineItems: InvoiceLineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  status: InvoiceStatus;
  dueDate?: string; // ISO date
  paidAt?: Timestamp;
  sentAt?: Timestamp;
  notes?: string;
  invoiceNumber: string;
  createdBy: string;
}

// ============================================================
// PROJECT TEMPLATES
// ============================================================

export interface ProjectTemplate extends BaseDocument {
  companyId: string;
  name: string;
  description?: string;
  defaultProjectType?: ProjectType;
  defaultFields: Partial<Pick<Project, 'addressState' | 'projectType' | 'metadata'>>;
  createdBy: string;
}

// ============================================================
// VOICE NOTES
// ============================================================

export interface VoiceNote {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  audioUrl?: string;
  transcription?: string;
  duration: number; // seconds
  projectId?: string;
  tags: string[];
  isTranscribing: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// ESTIMATES (Room-Level Hierarchy)
// ============================================================

export type EstimateStatus = 'draft' | 'pending' | 'approved' | 'sent' | 'archived';

/** Line item within an estimate area/category */
export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string; // SF, LF, EA, CY, HR, etc.
  unitCost: number; // in cents for precision
  totalCost: number; // quantity * unitCost (cents)
  category: string; // CSI division or custom (e.g., "Framing", "Electrical")
  notes?: string;
  /** Override global markup % for this line item */
  markupOverride?: number;
  /** Source of cost data */
  costSource?: 'manual' | 'rsmeans' | '1build' | 'assembly' | 'ai_estimated';
}

/** Area/Room within a project estimate (Room-Level Hierarchy) */
export interface EstimateArea {
  id: string;
  name: string; // e.g., "Kitchen", "Master Bath", "Exterior"
  description?: string;
  lineItems: EstimateLineItem[];
  subtotalCents: number;
}

/** Below-the-line markup configuration */
export interface EstimateMarkup {
  profitPercent: number; // e.g., 10 for 10%
  overheadPercent: number; // e.g., 8 for 8%
  taxPercent: number; // e.g., 9.25 for 9.25%
  contingencyPercent: number; // e.g., 5 for 5%
}

/** Full estimate document */
export interface Estimate extends BaseDocument {
  companyId: string;
  projectId: string;
  name: string;
  description?: string;
  status: EstimateStatus;
  areas: EstimateArea[];
  markup: EstimateMarkup;
  /** Computed totals (stored for quick access) */
  hardCostsCents: number; // sum of all line item totalCost
  profitCents: number;
  overheadCents: number;
  taxCents: number;
  contingencyCents: number;
  totalPriceCents: number;
  /** Gross Margin = (Total Price - Hard Costs) / Total Price */
  grossMarginPercent: number;
  /** ZIP code used for localized cost multiplier */
  zipCode?: string;
  costMultiplier?: number; // e.g., 0.92 for Knoxville, 1.45 for NYC
  /** JobTread sync reference */
  jobtreadEstimateId?: string;
  /** QuickBooks sync reference */
  quickbooksEstimateId?: string;
  createdBy: string;
}

/** Change Order linked to a locked estimate */
export interface ChangeOrder extends BaseDocument {
  companyId: string;
  projectId: string;
  estimateId: string; // parent locked estimate
  name: string;
  description?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  lineItems: EstimateLineItem[];
  totalCents: number;
  approvedBy?: string;
  approvedAt?: Timestamp;
  createdBy: string;
}

// ============================================================
// VENDORS (company-wide)
// ============================================================

export type VendorStatus = 'active' | 'inactive';

export interface Vendor extends BaseDocument {
  companyId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  notes?: string;
  status: VendorStatus;
  createdBy: string;
}

// Helper types for creating/updating documents
export type CreateData<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateData<T> = Partial<Omit<T, 'id' | 'createdAt'>>;
