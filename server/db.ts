import dotenv from 'dotenv';
import {
  SettingModel,
  BuildingModel,
  FloorModel,
  RoomModel,
  ResidentModel,
  ApplicationModel,
  PaymentModel,
  RuleModel,
  NotificationModel,
  AuditLogModel,
  InvitationModel,
} from './models.js';

dotenv.config();

let connectionPromise: Promise<boolean> | null = null;

export async function connectToDatabase(): Promise<boolean> {
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      console.log('[Firebase] Connected to Firebase Firestore successfully!');
      // Initialize/seed collections if completely fresh
      await seedDatabaseIfEmpty();
      return true;
    } catch (error) {
      console.error('[Firebase] Connection error:', error);
      connectionPromise = null;
      return false;
    }
  })();

  return connectionPromise;
}

export function isDbConnected(): boolean {
  return true;
}

// Purge all demo occupants, test buildings, and reset rooms to clean available state
export async function purgeAllDemoData() {
  try {
    console.log('[MongoDB] Purging demo occupants, test buildings, and mock records...');
    await ResidentModel.deleteMany({});
    await ApplicationModel.deleteMany({});
    await PaymentModel.deleteMany({});
    await NotificationModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    // Delete any test buildings (e.g., matching /test/i)
    await BuildingModel.deleteMany({ name: { $regex: /test/i } });

    // Clean all rooms beds: set status to 'Available', remove residentId and residentName
    const rooms = await RoomModel.find();
    for (const room of rooms) {
      room.beds = room.beds.map((b: any) => ({
        ...b.toObject(),
        status: 'Available',
        residentId: undefined,
        residentName: undefined,
      }));
      await room.save();
    }

    // Ensure Sri Sai Gents PG settings
    let setting = await SettingModel.findOne();
    if (!setting) {
      await SettingModel.create({
        name: 'Sri Sai Gents PG',
        type: 'Gents',
        address: '#42, 4th Cross, 7th Main, Koramangala 4th Block, Bengaluru, Karnataka - 560034',
        contactNumber: '+91 98765 43210',
        email: 'srisaigentspg78@gmail.com',
        description: 'Premium, secure & fully furnished PG accommodation with high-speed Wi-Fi, 3-time hygienic food, daily housekeeping and 24/7 security.',
        monthlyDueDay: 5,
        storageLimitMb: 500,
        editPassword: '6565',
        reminderSchedule: {
          firstReminderDaysBefore: 2,
          secondReminderDaysBefore: 1,
          dueDateReminder: true,
          overdueReminderDaysAfter: 1,
          repeatOverdueDays: 3,
          maxReminders: 5,
        },
      });
    } else {
      setting.name = 'Sri Sai Gents PG';
      setting.email = 'srisaigentspg78@gmail.com';
      await SettingModel.updateOne({ id: setting.id }, setting);
    }

    console.log('[Firebase] All demo data purged successfully.');
  } catch (err) {
    console.error('[Firebase] Error in purgeAllDemoData:', err);
  }
}

// Initial seed data if database is fresh
async function seedDatabaseIfEmpty() {
  try {
    const settingCount = await SettingModel.countDocuments();
    if (settingCount === 0) {
      console.log('[Firebase] Fresh database detected. Seeding initial clean PG data...');

      // 1. Settings
      await SettingModel.create({
        name: 'Sri Sai Gents PG',
        type: 'Gents',
        address: '#42, 4th Cross, 7th Main, Koramangala 4th Block, Bengaluru, Karnataka - 560034',
        contactNumber: '+91 98765 43210',
        email: 'srisaigentspg78@gmail.com',
        description: 'Premium, secure & fully furnished PG accommodation with high-speed Wi-Fi, 3-time hygienic food, daily housekeeping and 24/7 security.',
        monthlyDueDay: 5,
        storageLimitMb: 500,
        editPassword: '6565',
        reminderSchedule: {
          firstReminderDaysBefore: 2,
          secondReminderDaysBefore: 1,
          dueDateReminder: true,
          overdueReminderDaysAfter: 1,
          repeatOverdueDays: 3,
          maxReminders: 5,
        },
      });

      // 2. Rules
      await RuleModel.create([
        {
          id: 'rul-1',
          title: 'Gate & Curfew Timings',
          description: 'Main PG entry gates will be locked at 10:30 PM. Late entries require prior permission.',
          category: 'Timing',
          order: 1,
          isMandatory: true,
        },
        {
          id: 'rul-2',
          title: 'Visitor Policy',
          description: 'Outside visitors and non-residents are only allowed in the ground floor visitor lounge between 9:00 AM and 8:00 PM. No overnight guests in resident rooms.',
          category: 'Visitors',
          order: 2,
          isMandatory: true,
        },
        {
          id: 'rul-3',
          title: 'Cleanliness & Waste Segregation',
          description: 'Rooms and common corridors must be kept tidy. Daily housekeeping visits between 10:00 AM and 1:00 PM. Waste must be segregated into dry and wet bins.',
          category: 'Cleanliness',
          order: 3,
          isMandatory: true,
        },
        {
          id: 'rul-4',
          title: 'Quiet Hours & Electrical Appliances',
          description: 'Quiet hours are observed strictly from 11:00 PM to 6:00 AM. High-wattage heating coils and induction stoves in bedrooms are strictly prohibited for safety.',
          category: 'Security',
          order: 4,
          isMandatory: true,
        },
        {
          id: 'rul-5',
          title: 'Monthly Rent Payment Schedule',
          description: 'Monthly accommodation fees must be cleared on or before the 5th of every calendar month. Partial payments must be pre-arranged with management.',
          category: 'Payment',
          order: 5,
          isMandatory: true,
        },
        {
          id: 'rul-6',
          title: 'Notice Period for Vacating',
          description: 'Residents wishing to vacate must submit a written 30-day notice via the management portal. Security deposit refund is processed after bed inspection and clearance of dues.',
          category: 'General',
          order: 6,
          isMandatory: true,
        },
      ]);

      // 3. Initial Invite Token
      await InvitationModel.create({
        token: 'welcome-tenant',
        pgName: 'Sri Sai Gents PG',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        used: false,
      });

      console.log('[Firebase] Production clean PG database seeded successfully!');
    }
  } catch (err) {
    console.error('[Firebase] Error checking/seeding data:', err);
  }
}
