import {
  PGSettings,
  Building,
  Floor,
  Room,
  Resident,
  ResidentApplication,
  PaymentRecord,
  Rule,
  NotificationItem,
  StorageFile,
  AuditLog,
  Expense,
} from '../types';

export const initialPGSettings: PGSettings = {
  name: 'Sri Sai Gents PG',
  tagline: 'Premium Living for Professionals & Students',
  type: 'Gents',
  logo: '',
  address: '#42, 4th Cross, 7th Main, Koramangala 4th Block, Bengaluru, Karnataka - 560034',
  city: 'Bengaluru',
  pincode: '560034',
  contactNumber: '+91 98765 43210',
  phone: '+91 98765 43210',
  email: 'srisaigentspg78@gmail.com',
  helpdeskContact: '+91 98765 43210',
  helpdeskEmail: 'srisaigentspg78@gmail.com',
  description: 'Premium, secure & fully furnished PG accommodation with high-speed Wi-Fi, 3-time hygienic food, daily housekeeping and 24/7 security.',
  features: [
    'High-Speed Wi-Fi',
    '3 Times Hygienic Food',
    'Daily Housekeeping',
    '24/7 CCTV Security',
    'Power Backup',
    'RO Water Purifier',
    'Hot Water Geyser',
    'Washing Machine',
  ],
  upiId: 'abcpg@okaxis',
  monthlyDueDay: 5,
  storageLimitMb: 500,
  editPassword: '6565',
  adminPasscode: '6565',
  reminderSchedule: {
    firstReminderDaysBefore: 2,
    secondReminderDaysBefore: 1,
    dueDateReminder: true,
    overdueReminderDaysAfter: 1,
    repeatOverdueDays: 3,
    maxReminders: 5,
  },
};

export const initialBuildings: Building[] = [
  { id: 'bld-1', name: 'Building A (Main Wing)', description: '4 Floors, Premium rooms with attached balcony' },
  { id: 'bld-2', name: 'Building B (North Wing)', description: '3 Floors, Standard executive rooms' },
];

export const initialFloors: Floor[] = [
  { id: 'flr-g', buildingId: 'bld-1', name: 'Ground Floor', order: 0 },
  { id: 'flr-1', buildingId: 'bld-1', name: 'Floor 1', order: 1 },
  { id: 'flr-2', buildingId: 'bld-1', name: 'Floor 2', order: 2 },
  { id: 'flr-b-1', buildingId: 'bld-2', name: 'Floor 1', order: 1 },
  { id: 'flr-b-2', buildingId: 'bld-2', name: 'Floor 2', order: 2 },
];

export const initialRooms: Room[] = [
  {
    id: 'rm-101',
    buildingId: 'bld-1',
    floorId: 'flr-1',
    roomNumber: '101',
    sharingType: '2-Sharing',
    capacity: 2,
    baseRent: 9500,
    status: 'Active',
    beds: [
      { id: 'bed-101-1', roomId: 'rm-101', bedNumber: 'B1', status: 'Occupied', residentId: 'res-1', residentName: 'Rahul Sharma' },
      { id: 'bed-101-2', roomId: 'rm-101', bedNumber: 'B2', status: 'Occupied', residentId: 'res-2', residentName: 'Amit Verma' },
    ],
  },
  {
    id: 'rm-102',
    buildingId: 'bld-1',
    floorId: 'flr-1',
    roomNumber: '102',
    sharingType: '3-Sharing',
    capacity: 3,
    baseRent: 8500,
    status: 'Active',
    beds: [
      { id: 'bed-102-1', roomId: 'rm-102', bedNumber: 'B1', status: 'Available' },
      { id: 'bed-102-2', roomId: 'rm-102', bedNumber: 'B2', status: 'Available' },
      { id: 'bed-102-3', roomId: 'rm-102', bedNumber: 'B3', status: 'Available' },
    ],
  },
  {
    id: 'rm-201',
    buildingId: 'bld-1',
    floorId: 'flr-2',
    roomNumber: '201',
    sharingType: 'Single',
    capacity: 1,
    baseRent: 14000,
    status: 'Active',
    beds: [
      { id: 'bed-201-1', roomId: 'rm-201', bedNumber: 'B1', status: 'Available' },
    ],
  },
  {
    id: 'rm-202',
    buildingId: 'bld-1',
    floorId: 'flr-2',
    roomNumber: '202',
    sharingType: '2-Sharing',
    capacity: 2,
    baseRent: 9500,
    status: 'Active',
    beds: [
      { id: 'bed-202-1', roomId: 'rm-202', bedNumber: 'B1', status: 'Available' },
      { id: 'bed-202-2', roomId: 'rm-202', bedNumber: 'B2', status: 'Available' },
    ],
  },
  {
    id: 'rm-203',
    buildingId: 'bld-1',
    floorId: 'flr-2',
    roomNumber: '203',
    sharingType: '3-Sharing',
    capacity: 3,
    baseRent: 8500,
    status: 'Active',
    beds: [
      { id: 'bed-203-1', roomId: 'rm-203', bedNumber: 'B1', status: 'Available' },
      { id: 'bed-203-2', roomId: 'rm-203', bedNumber: 'B2', status: 'Available' },
      { id: 'bed-203-3', roomId: 'rm-203', bedNumber: 'B3', status: 'Available' },
    ],
  },
  {
    id: 'rm-b-101',
    buildingId: 'bld-2',
    floorId: 'flr-b-1',
    roomNumber: 'B-101',
    sharingType: '4-Sharing',
    capacity: 4,
    baseRent: 7500,
    status: 'Active',
    beds: [
      { id: 'bed-b-1', roomId: 'rm-b-101', bedNumber: 'B1', status: 'Available' },
      { id: 'bed-b-2', roomId: 'rm-b-101', bedNumber: 'B2', status: 'Available' },
      { id: 'bed-b-3', roomId: 'rm-b-101', bedNumber: 'B3', status: 'Available' },
      { id: 'bed-b-4', roomId: 'rm-b-101', bedNumber: 'B4', status: 'Available' },
    ],
  },
];

export const initialResidents: Resident[] = [
  {
    id: 'res-1',
    applicationId: 'app-101',
    fullName: 'Rahul Sharma',
    mobile: '+91 98765 11111',
    email: 'rahul.sharma@example.com',
    gender: 'Male',
    permanentAddress: '45, Residency Road, Jaipur',
    occupation: 'Software Engineer',
    emergencyContact: {
      relationship: 'Father',
      name: 'V. K. Sharma',
      phone: '+91 98765 22222',
    },
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    aadharUrl: '',
    aadharNumberMasked: 'XXXX-XXXX-4321',
    buildingId: 'bld-1',
    floorId: 'flr-1',
    roomId: 'rm-101',
    bedId: 'bed-101-1',
    roomNumber: '101',
    bedNumber: 'B1',
    sharingType: '2-Sharing',
    moveInDate: '2026-01-10',
    monthlyRent: 9500,
    securityDeposit: 5000,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'res-2',
    applicationId: 'app-102',
    fullName: 'Amit Verma',
    mobile: '+91 98765 33333',
    email: 'amit.verma@example.com',
    gender: 'Male',
    permanentAddress: '12, Boring Road, Patna',
    occupation: 'Data Analyst',
    emergencyContact: {
      relationship: 'Father',
      name: 'S. Verma',
      phone: '+91 98765 44444',
    },
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    aadharUrl: '',
    aadharNumberMasked: 'XXXX-XXXX-8877',
    buildingId: 'bld-1',
    floorId: 'flr-1',
    roomId: 'rm-101',
    bedId: 'bed-101-2',
    roomNumber: '101',
    bedNumber: 'B2',
    sharingType: '2-Sharing',
    moveInDate: '2026-02-01',
    monthlyRent: 9500,
    securityDeposit: 5000,
    status: 'ACTIVE',
    createdAt: '2026-02-01T10:00:00.000Z',
  }
];

export const initialApplications: ResidentApplication[] = [];

export const initialPayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    residentId: 'res-1',
    residentName: 'Rahul Sharma',
    roomNumber: '101',
    bedNumber: 'B1',
    billingMonth: 'August 2026',
    totalDueForMonth: 9500,
    amountPaid: 9500,
    remainingBalance: 0,
    paymentType: 'Rent',
    paymentMethod: 'UPI',
    status: 'Paid',
    transactionReference: 'UPI/22334455/SG',
    notes: 'Paid on time via GPay',
    paidAt: '2026-08-02T10:00:00.000Z',
    recordedBy: 'Admin',
  }
];

export const initialRules: Rule[] = [
  {
    id: 'rul-1',
    title: 'Gate Closure & Curfew Hours',
    description: 'Main PG gate closes at 10:30 PM sharp on weekdays and 11:00 PM on weekends. Late entry requires prior notice to PG manager via WhatsApp.',
    category: 'Timing',
    order: 1,
    isMandatory: true,
  },
  {
    id: 'rul-2',
    title: 'Monthly Rent Payment Schedule',
    description: 'Rent is due by the 5th of every calendar month. A grace period is provided until the 8th, post which late fees of ₹100/day apply.',
    category: 'Payment',
    order: 2,
    isMandatory: true,
  },
  {
    id: 'rul-3',
    title: 'Visitor & Guest Policy',
    description: 'Outside visitors/guests are strictly allowed only in the common lobby area between 9:00 AM and 7:00 PM. Overnight guest stays require prior admin written permission.',
    category: 'Visitors',
    order: 3,
    isMandatory: true,
  },
  {
    id: 'rul-4',
    title: 'Strict Prohibition of Smoking & Alcohol',
    description: 'Consumption or possession of alcohol, cigarettes, vape, and illicit substances is strictly prohibited on the entire PG premises and will result in immediate termination of stay.',
    category: 'Security',
    order: 4,
    isMandatory: true,
  },
  {
    id: 'rul-5',
    title: 'Electricity & Appliance Usage',
    description: 'Turn off room lights, fans, and geysers when leaving the room. Heavy heating coils and unapproved high-power appliances are strictly prohibited in rooms.',
    category: 'Cleanliness',
    order: 5,
    isMandatory: true,
  },
  {
    id: 'rul-6',
    title: '30-Day Notice Period Before Vacating',
    description: 'Residents must submit a 30-day formal notice prior to vacating to process full security deposit refund minus room maintenance/settlement charges.',
    category: 'General',
    order: 6,
    isMandatory: true,
  },
];

export const initialStorageFiles: StorageFile[] = [];

export const initialNotifications: NotificationItem[] = [];

export const initialAuditLogs: AuditLog[] = [];

export const initialExpenses: Expense[] = [];
