export type SharingType = 'Single' | '2-Sharing' | '3-Sharing' | '4-Sharing' | 'Custom';

export type BedStatus = 'Available' | 'Occupied' | 'Maintenance';

export type PGType = 'Gents' | 'Ladies' | 'Co-ed';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED';

export type ResidentStatus = 'ACTIVE' | 'NOTICE' | 'VACATED';

export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Due' | 'Overdue';

export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer' | 'Other';

export type PaymentType = 'Rent' | 'Security Deposit' | 'Maintenance' | 'Other';

export interface EmergencyContact {
  relationship: 'Father' | 'Mother' | 'Brother' | 'Sister' | 'Guardian' | 'Spouse' | 'Other';
  name: string;
  phone: string;
}

export interface PGSettings {
  name: string;
  tagline?: string;
  type: PGType;
  logo?: string;
  address: string;
  city?: string;
  pincode?: string;
  contactNumber: string;
  phone?: string;
  email: string;
  helpdeskContact?: string;
  helpdeskEmail?: string;
  description: string;
  features?: string[];
  upiId?: string;
  monthlyDueDay: number; // e.g., 5th of the month
  storageLimitMb: number; // default 500 MB
  editPassword: string; // default '6565'
  adminPasscode?: string;
  reminderSchedule: {
    firstReminderDaysBefore: number; // 2 days
    secondReminderDaysBefore: number; // 1 day
    dueDateReminder: boolean;
    overdueReminderDaysAfter: number; // 1 day
    repeatOverdueDays: number; // every 3 days
    maxReminders: number; // 5
  };
}

export interface Building {
  id: string;
  name: string;
  description?: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string; // e.g. "Ground Floor", "Floor 1", "Floor 2"
  order: number;
}

export interface Bed {
  id: string;
  roomId: string;
  bedNumber: string; // e.g. "B1", "B2", "B3"
  status: BedStatus;
  residentId?: string;
  residentName?: string;
}

export interface Room {
  id: string;
  buildingId: string;
  floorId: string;
  roomNumber: string; // e.g. "101", "203", "G-01"
  sharingType: SharingType;
  capacity: number;
  baseRent: number;
  status: 'Active' | 'Maintenance';
  beds: Bed[];
}

export interface ResidentApplication {
  id: string; // e.g. "APP-8219"
  invitationToken?: string;
  status: ApplicationStatus;
  fullName: string;
  mobile: string;
  email: string; // Gmail
  gender: 'Male' | 'Female' | 'Other';
  dob?: string;
  permanentAddress: string;
  occupation: string;
  emergencyContact: EmergencyContact;
  photoUrl: string;
  photoSizeBytes: number;
  aadharUrl: string;
  aadharSizeBytes: number;
  aadharNumberMasked: string; // e.g. "XXXX-XXXX-8921"
  acceptedRulesVersion: string;
  acceptedAt: string;
  submittedAt: string;
  rejectionReason?: string;
  correctionNote?: string;
}

export interface Resident {
  id: string; // e.g. "RES-1042"
  applicationId: string;
  fullName: string;
  mobile: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other';
  permanentAddress: string;
  occupation: string;
  emergencyContact: EmergencyContact;
  photoUrl: string;
  aadharUrl: string;
  aadharNumberMasked: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  bedId: string;
  roomNumber: string;
  bedNumber: string;
  sharingType: SharingType;
  moveInDate: string; // YYYY-MM-DD
  monthlyRent: number;
  securityDeposit: number;
  status: ResidentStatus;
  noticeDate?: string;
  vacatedDate?: string;
  createdAt: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string; // e.g. "PAY-3041"
  residentId: string;
  residentName: string;
  roomNumber: string;
  bedNumber: string;
  billingMonth: string; // e.g. "August 2026"
  totalDueForMonth: number;
  amountPaid: number;
  remainingBalance: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  notes?: string;
  paidAt: string; // ISO date string
  recordedBy: string;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  category: 'General' | 'Timing' | 'Visitors' | 'Cleanliness' | 'Security' | 'Payment';
  order: number;
  isMandatory: boolean;
}

export interface NotificationItem {
  id: string;
  recipientType: 'ADMIN' | 'TENANT';
  residentId?: string;
  title: string;
  message: string;
  channel: 'IN_APP' | 'PUSH' | 'EMAIL' | 'WHATSAPP';
  type: 'APPLICATION' | 'PAYMENT_DUE' | 'PAYMENT_RECORDED' | 'APPROVAL' | 'ANNOUNCEMENT' | 'STORAGE_ALERT';
  timestamp: string;
  read: boolean;
  linkUrl?: string;
}

export interface StorageFile {
  id: string;
  fileName: string;
  fileType: 'PROFILE_PHOTO' | 'AADHAAR_DOCUMENT' | 'RECEIPT' | 'OTHER';
  mimeType: string;
  sizeBytes: number;
  sizeMb: number;
  residentId?: string;
  residentName?: string;
  uploadedAt: string;
  dataUrl?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  details?: string;
}

export type ExpenseCategory =
  | 'Groceries'
  | 'Maintenance'
  | 'Utilities'
  | 'Staff Salary'
  | 'Housekeeping'
  | 'Other';

export interface Expense {
  id: string; // e.g. "EXP-1001"
  title: string; // e.g. "Weekly Vegetables & Groceries"
  amount: number;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM (e.g. "2026-09")
  buildingId?: string;
  buildingName?: string;
  notes?: string;
  createdAt: string;
}
