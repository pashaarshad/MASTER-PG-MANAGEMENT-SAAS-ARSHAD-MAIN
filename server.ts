import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { connectToDatabase, isDbConnected } from './server/db.js';
import { deleteFromStorage } from './server/firebase.js';
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
  ExpenseModel,
} from './server/models.js';
import {
  sendEmail,
  sendEmailOtp,
  sendApplicationSubmittedEmails,
  sendApplicationApprovedEmail,
  sendPaymentReceiptEmail,
  sendRentDueReminderEmail,
} from './server/email.js';

const app = express();
const PORT = 3000;

// OTP Store for Email Verification: cleanEmail -> { otp: string, expiresAt: number }
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// Real-time Server-Sent Events (SSE) Client Connections
const sseClients = new Set<express.Response>();

export function broadcastRealtime(type: string, data?: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`event: message\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Body parsers with large limit for image data URLs
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initial MongoDB connection
connectToDatabase();

// Auto-connect to DB before API handlers if in serverless environment
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await connectToDatabase();
    } catch (err) {
      console.error('[Middleware DB Connect Error]:', err);
    }
  }
  next();
});

// ==========================================
// 1. Health & Diagnostics & Real-Time SSE
// ==========================================
app.get('/api/health', (req, res) => {
  const connected = isDbConnected();
  res.json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    mongoDbConnected: connected,
    connectedClients: sseClients.size,
    timestamp: new Date().toISOString(),
  });
});

// Admin Authentication Route (Password updated: removed admin123)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = username && username.trim().toLowerCase() === 'admin';
  const allowedPasswords = ['@srisaigentspg', 'Arshad.com', 'srisaigentspg'];

  if (validUser && allowedPasswords.includes(password)) {
    return res.json({
      success: true,
      user: { role: 'admin', username: 'admin' },
      message: 'Authentication successful',
    });
  }
  return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

// ==========================================
// 1.1 Email OTP Verification Routes
// ==========================================
app.post('/api/otp/send', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email / Gmail address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    otpStore.set(cleanEmail, { otp, expiresAt });

    const settings = await SettingModel.findOne();
    const pgName = settings?.name || 'Sri Sai Gents PG';
    const pgLogo = settings?.logo || '';
    const pgAddress = settings?.address || '';
    const pgContact = settings?.contactNumber || settings?.phone || '+91 98765 43210';
    const pgEmail = settings?.email || 'srisaigentspg78@gmail.com';

    // Dispatch OTP email to recipient inbox
    const emailResult = await sendEmailOtp({
      email: cleanEmail,
      otp,
      name,
      pgName,
      pgLogo,
      pgAddress,
      pgContact,
      pgEmail,
    });

    console.log(`[OTP Engine] Generated and dispatched 6-digit OTP to ${cleanEmail}`);

    res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox or spam folder.`,
    });
  } catch (error: any) {
    console.error('[API /api/otp/send] Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send OTP' });
  }
});

app.post('/api/otp/verify', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({ success: false, error: 'No OTP requested for this email or OTP expired. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new code.' });
    }

    if (record.otp !== cleanOtp) {
      return res.status(400).json({ success: false, error: 'Invalid verification OTP. Please check the code and try again.' });
    }

    // Success - consume OTP
    otpStore.delete(cleanEmail);
    res.json({
      success: true,
      verified: true,
      email: cleanEmail,
      message: 'Gmail ID successfully verified!',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Production Clean Data Route to reset all demo items in Firebase
app.post('/api/admin/clean-demo-data', async (req, res) => {
  try {
    await ResidentModel.deleteMany({});
    await ApplicationModel.deleteMany({});
    await PaymentModel.deleteMany({});
    await NotificationModel.deleteMany({});
    await AuditLogModel.deleteMany({});

    // Reset all rooms beds to Available
    const rooms = await RoomModel.find().lean();
    for (const room of rooms) {
      const updatedBeds = (room.beds || []).map((b: any) => ({
        ...b,
        status: 'Available',
        residentId: null,
        residentName: null,
      }));
      await RoomModel.updateOne({ id: room.id }, { beds: updatedBeds });
    }

    // Reset setting name
    const settings = await SettingModel.findOne().lean();
    if (settings) {
      await SettingModel.updateOne({ id: settings.id }, { name: 'Sri Sai Gents PG', email: 'srisaigentspg78@gmail.com' });
    }

    broadcastRealtime('DATA_CLEANED', { cleaned: true });
    res.json({ success: true, message: 'All demo data cleared and system set to production clean state.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Diagnostics Endpoint for Vercel Deployments
app.get('/api/diagnostics', async (req, res) => {
  try {
    const variables = {
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ? 'Present' : 'Missing',
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ? 'Present' : 'Missing',
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'Present' : 'Missing',
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ? 'Present' : 'Missing',
      GMAIL_USER: process.env.GMAIL_USER ? 'Present' : 'Missing',
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? 'Present' : 'Missing',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Present' : 'Missing',
    };

    let firebaseConnection = 'Unknown';
    let firebaseTestWrite = 'Unknown';
    
    try {
      await connectToDatabase();
      firebaseConnection = 'Success (Connected)';
      
      // Test write/read to a dummy collection
      const dummyId = `diag-${Date.now()}`;
      await SettingModel.updateOne({ id: 'dummy-diagnostic-id' }, { name: 'Diagnostic Test Run' });
      firebaseTestWrite = 'Success (Can Write)';
    } catch (fErr: any) {
      firebaseConnection = `Failed: ${fErr.message}`;
      firebaseTestWrite = 'Failed (Cannot Write)';
    }

    res.json({
      success: true,
      environment: process.env.NODE_ENV || 'development',
      isVercel: !!process.env.VERCEL,
      environmentVariables: variables,
      firebaseStatus: {
        connection: firebaseConnection,
        testWrite: firebaseTestWrite,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/api/realtime', (req, res) => {
  // Always set EventStream headers to satisfy browser EventSource MIME type requirements
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // If in a serverless environment (e.g. Vercel), long-lived SSE connections are not supported
  if (process.env.VERCEL) {
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', mode: 'polling', timestamp: new Date().toISOString() })}\n\n`);
    res.end();
    return;
  }

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  const intervalId = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(intervalId);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(intervalId);
    sseClients.delete(res);
  });
});

// ==========================================
// 2. Full Bootstrap Data (Fast Hydration)
// ==========================================
app.get('/api/bootstrap', async (req, res) => {
  try {
    await connectToDatabase();

    const [
      settings,
      buildings,
      floors,
      rooms,
      residents,
      applications,
      payments,
      rules,
      notifications,
      auditLogs,
    ] = await Promise.all([
      SettingModel.findOne().lean(),
      BuildingModel.find().lean(),
      FloorModel.find().sort({ order: 1 }).lean(),
      RoomModel.find().lean(),
      ResidentModel.find().sort({ createdAt: -1 }).lean(),
      ApplicationModel.find().sort({ submittedAt: -1 }).lean(),
      PaymentModel.find().sort({ paidAt: -1 }).lean(),
      RuleModel.find().sort({ order: 1 }).lean(),
      NotificationModel.find().sort({ timestamp: -1 }).lean(),
      AuditLogModel.find().sort({ timestamp: -1 }).limit(100).lean(),
    ]);

    res.json({
      success: true,
      data: {
        pgSettings: settings || {
          name: 'ABC DEF PG',
          type: 'Gents',
          address: '#42, 4th Cross, 7th Main, Koramangala 4th Block, Bengaluru, Karnataka - 560034',
          contactNumber: '+91 98765 43210',
          email: 'srisaigentspg78@gmail.com',
          description: 'Premium, secure & fully furnished PG accommodation.',
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
        },
        buildings: buildings || [],
        floors: floors || [],
        rooms: rooms || [],
        residents: residents || [],
        applications: applications || [],
        payments: payments || [],
        rules: rules || [],
        notifications: notifications || [],
        storageFiles: [],
        auditLogs: auditLogs || [],
      },
    });
  } catch (error: any) {
    console.error('[API /api/bootstrap] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. Settings Endpoints
// ==========================================
app.put('/api/settings', async (req, res) => {
  try {
    const updates = req.body;
    let setting = await SettingModel.findOne().lean();
    if (setting) {
      const merged = { ...setting, ...updates };
      await SettingModel.updateOne({ id: setting.id }, merged);
      setting = merged;
    } else {
      setting = await SettingModel.create(updates);
    }

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'SETTINGS_UPDATED',
      actor: 'Admin',
      target: 'PG Profile & Configuration',
      details: 'Updated PG settings in Firebase',
      timestamp: new Date().toISOString(),
    });

    broadcastRealtime('SETTINGS_UPDATED', setting);
    res.json({ success: true, setting });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. Buildings & Floors Endpoints
// ==========================================
app.post('/api/buildings', async (req, res) => {
  try {
    const { name, description } = req.body;
    const id = `bld-${Date.now()}`;
    const building = await BuildingModel.create({ id, name, description });

    // Auto-create Ground Floor
    const floorId = `flr-${Date.now()}`;
    const floor = await FloorModel.create({ id: floorId, buildingId: id, name: 'Ground Floor', order: 0 });

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'BUILDING_CREATED',
      actor: 'Admin',
      target: name,
      details: `Added new building ${name} with Ground Floor`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, building, floor });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/buildings/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const building = await BuildingModel.findOneAndUpdate(
      { id: req.params.id },
      { name, description },
      { new: true }
    );
    res.json({ success: true, building });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/buildings/:id', async (req, res) => {
  try {
    const buildingId = req.params.id;
    // Check if there are active residents in this building
    const hasActiveResidents = await ResidentModel.exists({
      buildingId,
      status: { $ne: 'VACATED' },
    });
    if (hasActiveResidents) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete building with active tenants. Please relocate or vacate tenants first.',
      });
    }
    await RoomModel.deleteMany({ buildingId });
    await FloorModel.deleteMany({ buildingId });
    await BuildingModel.deleteOne({ id: buildingId });

    broadcastRealtime('BUILDING_DELETED', { buildingId });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/floors', async (req, res) => {
  try {
    const { id: clientFloorId, buildingId, name } = req.body;
    const cleanName = (name || '').trim();
    // Check if floor with same name already exists in this building
    const existing = await FloorModel.findOne({ buildingId, name: cleanName }).lean();
    if (existing) {
      return res.json({ success: true, floor: existing });
    }

    const id = clientFloorId || `flr-${Date.now()}`;
    const count = await FloorModel.countDocuments({ buildingId });
    const floor = await FloorModel.create({ id, buildingId, name: cleanName, order: count });
    broadcastRealtime('FLOOR_CREATED', { floor });
    res.json({ success: true, floor });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/floors/:id', async (req, res) => {
  try {
    const hasRooms = await RoomModel.exists({ floorId: req.params.id });
    if (hasRooms) {
      return res.status(400).json({ success: false, error: 'Cannot delete floor that has rooms.' });
    }
    await FloorModel.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. Rooms & Beds Endpoints
// ==========================================
app.post('/api/rooms', async (req, res) => {
  try {
    const { buildingId, floorId, roomNumber, sharingType, capacity, baseRent } = req.body;
    const roomId = `rm-${Date.now()}`;

    const beds = Array.from({ length: capacity }, (_, i) => ({
      id: `bed-${roomId}-${i + 1}`,
      roomId,
      bedNumber: `B${i + 1}`,
      status: 'Available' as const,
    }));

    const room = await RoomModel.create({
      id: roomId,
      buildingId,
      floorId,
      roomNumber,
      sharingType,
      capacity,
      baseRent,
      status: 'Active',
      beds,
    });

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'ROOM_CREATED',
      actor: 'Admin',
      target: `Room ${roomNumber}`,
      details: `Created ${sharingType} with ${capacity} beds at ₹${baseRent}/mo`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/rooms/:id', async (req, res) => {
  try {
    const updates = req.body;
    const room = await RoomModel.findOneAndUpdate({ id: req.params.id }, updates, { new: true });
    res.json({ success: true, room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const room = await RoomModel.findOne({ id: req.params.id });
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const hasOccupants = room.beds?.some((b: any) => b.status === 'Occupied');
    if (hasOccupants) {
      return res.status(400).json({ success: false, error: 'Cannot delete room with active occupants.' });
    }

    await RoomModel.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/beds/:bedId/status', async (req, res) => {
  try {
    const { bedId } = req.params;
    const { status } = req.body;

    const room = await RoomModel.findOne({ 'beds.id': bedId }).lean();
    if (!room) return res.status(404).json({ success: false, error: 'Bed not found' });

    const updatedBeds = (room.beds || []).map((b: any) => {
      if (b.id === bedId) {
        return {
          ...b,
          status,
          ...(status === 'Available' ? { residentId: null, residentName: null } : {}),
        };
      }
      return b;
    });

    await RoomModel.updateOne({ id: room.id }, { beds: updatedBeds });
    const updatedRoom = await RoomModel.findOne({ id: room.id }).lean();
    res.json({ success: true, room: updatedRoom });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. Tenant Invitation Links (INVITE TENANT)
// ==========================================
app.post('/api/invitations', async (req, res) => {
  try {
    const token = `inv-${Math.random().toString(36).substring(2, 10)}`;
    const settings = await SettingModel.findOne().lean();
    const pgName = settings?.name || 'ABC DEF PG';

    const invitation = await InvitationModel.create({
      token,
      pgName,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days valid
      used: false,
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const link = `${protocol}://${host}/join/${token}`;

    res.json({
      success: true,
      token,
      link,
      invitation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/invitations/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const invitation = await InvitationModel.findOne({ token }).lean();
    const settings = await SettingModel.findOne().lean();

    res.json({
      success: true,
      valid: !!invitation,
      invitation,
      pgSettings: settings,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. Applications Endpoints (Onboarding)
// ==========================================
app.post('/api/applications', async (req, res) => {
  try {
    const appData = req.body;
    
    // Calculate sequential numeric ID starting from 1001
    const allApps = await ApplicationModel.find({}, { id: 1 }).lean();
    const allRes = await ResidentModel.find({}, { id: 1 }).lean();
    let maxNum = 1000;

    for (const a of allApps) {
      const m = a.id?.match(/(?:APP|RES)[-_]?(\d+)/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val >= 1000 && val < 50000) maxNum = Math.max(maxNum, val);
      }
    }
    for (const r of allRes) {
      const m = r.id?.match(/(?:APP|RES)[-_]?(\d+)/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val >= 1000 && val < 50000) maxNum = Math.max(maxNum, val);
      }
    }

    const nextSeq = maxNum + 1;
    const appId = `APP-${nextSeq}`;

    // Images (photoUrl, aadharUrl) are stored as base64 data URLs directly in Firestore
    // No Firebase Storage needed - works immediately without any Storage rule setup

    const newApp = await ApplicationModel.create({
      ...appData,
      id: appId,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
    });

    // Mark invite token as used if present
    if (appData.invitationToken) {
      await InvitationModel.findOneAndUpdate(
        { token: appData.invitationToken },
        { used: true, usedByApplicationId: appId }
      );
    }

    // Admin Notification
    await NotificationModel.create({
      id: `notif-${Date.now()}`,
      recipientType: 'ADMIN',
      title: 'New Resident Application Received',
      message: `${appData.fullName} has submitted an onboarding application (${appId}) for review.`,
      channel: 'IN_APP',
      type: 'APPLICATION',
      linkUrl: 'applications',
      timestamp: new Date().toISOString(),
      read: false,
    });

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'APPLICATION_SUBMITTED',
      actor: appData.fullName,
      target: appId,
      details: `Submitted onboarding application from public portal`,
      timestamp: new Date().toISOString(),
    });

    // Real-time broadcast to all connected admin tabs
    broadcastRealtime('APPLICATION_SUBMITTED', newApp);

    // Fetch PG Settings to get official name and admin email
    const settings = await SettingModel.findOne();
    const pgName = settings?.name || 'Sri Sai Gents PG';
    const pgLogo = settings?.logo || '';
    const pgAddress = settings?.address || '';
    const pgContact = settings?.contactNumber || settings?.phone || '+91 98765 43210';
    const adminEmail = settings?.email || 'srisaigentspg78@gmail.com';
    const allRules = await RuleModel.find().sort({ order: 1 });

    // Asynchronously send transactional emails via Gmail / Resend
    sendApplicationSubmittedEmails({
      applicantEmail: appData.email,
      applicantName: appData.fullName,
      applicantPhone: appData.mobile,
      applicationId: appId,
      pgName,
      pgLogo,
      pgAddress,
      pgContact,
      adminEmail,
      rules: allRules.map((r: any) => ({ title: r.title, category: r.category, description: r.description })),
    }).catch((err) => console.error('[Onboarding Email Error]:', err));

    res.json({ success: true, appId, application: newApp });
  } catch (error: any) {
    console.error('[API /api/applications] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/applications/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const allocation = req.body; // { buildingId, floorId, roomId, bedId, monthlyRent, securityDeposit, moveInDate, notes }

    const appDoc = await ApplicationModel.findOne({ id });
    if (!appDoc) return res.status(404).json({ success: false, error: 'Application not found' });

    const room = await RoomModel.findOne({ id: allocation.roomId });
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const bed = room.beds.find((b: any) => b.id === allocation.bedId);
    if (!bed) return res.status(404).json({ success: false, error: 'Bed not found' });

    // Match application reference ID (e.g. APP-1001 -> RES-1001)
    let residentId: string;
    const appNumMatch = appDoc.id.match(/(?:APP)[-_]?(\d+)/i);
    if (appNumMatch) {
      residentId = `RES-${appNumMatch[1]}`;
    } else {
      const residentCount = await ResidentModel.countDocuments();
      residentId = `RES-${1000 + residentCount + 1}`;
    }

    // 1. Create Resident
    const resident = await ResidentModel.create({
      id: residentId,
      applicationId: appDoc.id,
      fullName: appDoc.fullName,
      mobile: appDoc.mobile,
      email: appDoc.email,
      gender: appDoc.gender,
      permanentAddress: appDoc.permanentAddress,
      occupation: appDoc.occupation,
      emergencyContact: appDoc.emergencyContact,
      photoUrl: appDoc.photoUrl,
      aadharUrl: appDoc.aadharUrl,
      aadharNumberMasked: appDoc.aadharNumberMasked,
      buildingId: allocation.buildingId,
      floorId: allocation.floorId,
      roomId: allocation.roomId,
      bedId: allocation.bedId,
      roomNumber: room.roomNumber,
      bedNumber: bed.bedNumber,
      sharingType: room.sharingType,
      moveInDate: allocation.moveInDate,
      monthlyRent: allocation.monthlyRent,
      securityDeposit: allocation.securityDeposit || 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      notes: allocation.notes || '',
    });

    // 2. Mark Bed Occupied
    const updatedBeds = (room.beds || []).map((b: any) => {
      if (b.id === allocation.bedId) {
        return { ...b, status: 'Occupied', residentId, residentName: appDoc.fullName };
      }
      return b;
    });
    await RoomModel.updateOne({ id: room.id }, { beds: updatedBeds });

    // 3. Mark Application Approved
    await ApplicationModel.updateOne({ id }, { status: 'APPROVED' });

    // 4. Initial Security Deposit record
    if (allocation.securityDeposit > 0) {
      await PaymentModel.create({
        id: `PAY-${Date.now().toString().slice(-4)}`,
        residentId,
        residentName: appDoc.fullName,
        roomNumber: room.roomNumber,
        bedNumber: bed.bedNumber,
        billingMonth: 'Security Deposit',
        totalDueForMonth: allocation.securityDeposit,
        amountPaid: allocation.securityDeposit,
        remainingBalance: 0,
        paymentType: 'Security Deposit',
        paymentMethod: 'Bank Transfer',
        status: 'Paid',
        notes: 'Security deposit collected on admission.',
        paidAt: new Date().toISOString(),
        recordedBy: 'Admin',
      });
    }

    // 5. Notifications
    await NotificationModel.create({
      id: `notif-${Date.now()}`,
      recipientType: 'ADMIN',
      residentId,
      title: 'Resident Approved & Bed Allocated',
      message: `${appDoc.fullName} assigned to Room ${room.roomNumber} (${bed.bedNumber}) with Resident ID: ${residentId}.`,
      channel: 'IN_APP',
      type: 'APPROVAL',
      linkUrl: 'residents',
      timestamp: new Date().toISOString(),
      read: false,
    });

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'APPLICATION_APPROVED',
      actor: 'Admin',
      target: `${appDoc.fullName} (${residentId})`,
      details: `Approved application and allocated Room ${room.roomNumber}, Bed ${bed.bedNumber}`,
      timestamp: new Date().toISOString(),
    });

    // Real-time broadcast
    broadcastRealtime('APPLICATION_APPROVED', { resident, room, application: appDoc });

    // Send official welcome & allotment email via Resend / Gmail
    const settings = await SettingModel.findOne();
    const pgName = settings?.name || 'Sri Sai Gents PG';
    const pgLogo = settings?.logo || '';
    const pgAddress = settings?.address || 'Bangalore, Karnataka';
    const pgContact = settings?.contactNumber || settings?.phone || '+91 98765 43210';
    const pgEmail = settings?.email || 'srisaigentspg78@gmail.com';
    const allRules = await RuleModel.find().sort({ order: 1 });

    sendApplicationApprovedEmail({
      residentEmail: resident.email,
      residentName: resident.fullName,
      residentId,
      roomNumber: room.roomNumber,
      bedNumber: bed.bedNumber,
      sharingType: room.sharingType,
      monthlyRent: allocation.monthlyRent,
      securityDeposit: allocation.securityDeposit || 0,
      moveInDate: allocation.moveInDate,
      pgName,
      pgLogo,
      pgAddress,
      pgContact,
      pgEmail,
      rules: allRules.map((r: any) => ({ title: r.title, category: r.category, description: r.description })),
    }).catch((err) => console.error('[Approval Email Error]:', err));

    res.json({ success: true, residentId, resident });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/applications/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appDoc = await ApplicationModel.findOneAndUpdate(
      { id },
      { status: 'REJECTED', rejectionReason: reason },
      { new: true }
    );

    broadcastRealtime('APPLICATION_REJECTED', appDoc);
    res.json({ success: true, application: appDoc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/applications/:id/request-correction', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const appDoc = await ApplicationModel.findOneAndUpdate(
      { id },
      { status: 'CORRECTION_REQUESTED', correctionNote: note },
      { new: true }
    );

    broadcastRealtime('APPLICATION_CORRECTION_REQUESTED', appDoc);
    res.json({ success: true, application: appDoc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8. Residents Endpoints
// ==========================================
app.put('/api/residents/:id', async (req, res) => {
  try {
    const updates = req.body;
    const residentId = req.params.id;
    const existing = await ResidentModel.findOne({ id: residentId });
    if (!existing) return res.status(404).json({ success: false, error: 'Resident not found' });

    // Check if bed or room changed
    if (updates.bedId && updates.bedId !== existing.bedId) {
      // 1. Free old bed
      if (existing.roomId && existing.bedId) {
        const oldRoom = await RoomModel.findOne({ id: existing.roomId });
        if (oldRoom) {
          const updatedOldBeds = (oldRoom.beds || []).map((b: any) => {
            if (b.id === existing.bedId) {
              return { ...b, status: 'Available', residentId: null, residentName: null };
            }
            return b;
          });
          await RoomModel.updateOne({ id: oldRoom.id }, { beds: updatedOldBeds });
          broadcastRealtime('ROOM_UPDATED', { ...oldRoom, beds: updatedOldBeds });
        }
      }

      // 2. Occupy new bed
      const targetRoomId = updates.roomId || existing.roomId;
      const targetRoom = await RoomModel.findOne({ id: targetRoomId });
      if (targetRoom) {
        const targetBed = targetRoom.beds.find((b: any) => b.id === updates.bedId);
        if (targetBed) {
          const updatedNewBeds = (targetRoom.beds || []).map((b: any) => {
            if (b.id === updates.bedId) {
              return { ...b, status: 'Occupied', residentId, residentName: updates.fullName || existing.fullName };
            }
            return b;
          });
          await RoomModel.updateOne({ id: targetRoom.id }, { beds: updatedNewBeds });
          broadcastRealtime('ROOM_UPDATED', { ...targetRoom, beds: updatedNewBeds });

          updates.roomNumber = targetRoom.roomNumber;
          updates.bedNumber = targetBed.bedNumber;
          updates.sharingType = targetRoom.sharingType;
        }
      }
    }

    const merged = { ...existing, ...updates };
    await ResidentModel.updateOne({ id: residentId }, merged);

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'RESIDENT_UPDATED',
      actor: 'Admin',
      target: `${existing.fullName} (${residentId})`,
      details: updates.roomNumber
        ? `Updated profile and allocated to Room ${updates.roomNumber} (${updates.bedNumber})`
        : `Updated resident profile details`,
      timestamp: new Date().toISOString(),
    });

    broadcastRealtime('RESIDENT_UPDATED', existing);
    res.json({ success: true, resident: existing });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/residents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, noticeDate, vacatedDate } = req.body;

    const resident = await ResidentModel.findOne({ id }).lean();
    if (!resident) return res.status(404).json({ success: false, error: 'Resident not found' });

    const updatedResident = {
      ...resident,
      status,
      ...(noticeDate ? { noticeDate } : {}),
      ...(vacatedDate ? { vacatedDate } : {}),
    };
    await ResidentModel.updateOne({ id }, updatedResident);

    // If vacated, free the bed
    if (status === 'VACATED') {
      const room = await RoomModel.findOne({ id: resident.roomId }).lean();
      if (room) {
        const updatedBeds = (room.beds || []).map((b: any) => {
          if (b.id === resident.bedId) {
            return { ...b, status: 'Available', residentId: null, residentName: null };
          }
          return b;
        });
        await RoomModel.updateOne({ id: room.id }, { beds: updatedBeds });
        broadcastRealtime('ROOM_UPDATED', { ...room, beds: updatedBeds });
      }
    }

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'RESIDENT_STATUS_CHANGED',
      actor: 'Admin',
      target: `${resident.fullName} (${id})`,
      details: `Status updated to ${status}`,
      timestamp: new Date().toISOString(),
    });

    broadcastRealtime('RESIDENT_STATUS_CHANGED', updatedResident);
    res.json({ success: true, resident: updatedResident });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 9. Payments Endpoints
// ==========================================
app.post('/api/payments', async (req, res) => {
  try {
    const pData = req.body;
    const resident = await ResidentModel.findOne({ id: pData.residentId });
    if (!resident) return res.status(404).json({ success: false, error: 'Resident not found' });

    const paymentId = `PAY-${Date.now().toString().slice(-4)}`;
    const remaining = Math.max(0, pData.totalDueForMonth - pData.amountPaid);
    const status = remaining === 0 ? 'Paid' : 'Partially Paid';

    const payment = await PaymentModel.create({
      id: paymentId,
      residentId: resident.id,
      residentName: resident.fullName,
      roomNumber: resident.roomNumber,
      bedNumber: resident.bedNumber,
      billingMonth: pData.billingMonth,
      totalDueForMonth: pData.totalDueForMonth,
      amountPaid: pData.amountPaid,
      remainingBalance: remaining,
      paymentType: pData.paymentType || 'Rent',
      paymentMethod: pData.paymentMethod || 'UPI',
      status,
      transactionReference: pData.transactionReference,
      notes: pData.notes,
      paidAt: new Date().toISOString(),
      recordedBy: 'Admin',
    });

    // Admin Notification
    await NotificationModel.create({
      id: `notif-${Date.now()}`,
      recipientType: 'ADMIN',
      residentId: resident.id,
      title: `Payment Received: ₹${pData.amountPaid.toLocaleString('en-IN')}`,
      message: `Recorded ${status.toLowerCase()} from ${resident.fullName} (${resident.roomNumber}-${resident.bedNumber}). ${
        remaining > 0 ? `Remaining Due: ₹${remaining.toLocaleString('en-IN')}` : 'Full amount cleared.'
      }`,
      channel: 'IN_APP',
      type: 'PAYMENT_RECORDED',
      linkUrl: 'payments',
      timestamp: new Date().toISOString(),
      read: false,
    });

    await AuditLogModel.create({
      id: `aud-${Date.now()}`,
      action: 'PAYMENT_RECORDED',
      actor: 'Admin',
      target: `${resident.fullName} (${paymentId})`,
      details: `Collected ₹${pData.amountPaid} for ${pData.billingMonth} via ${pData.paymentMethod}. Remaining: ₹${remaining}`,
      timestamp: new Date().toISOString(),
    });

    // Real-time broadcast
    broadcastRealtime('PAYMENT_RECORDED', payment);

    // Send digital receipt email via Resend
    const settings = await SettingModel.findOne();
    const pgName = settings?.name || 'Sri Sai Gents PG';
    const pgLogo = settings?.logo || '';
    const pgAddress = settings?.address || '';
    const pgContact = settings?.contactNumber || settings?.phone || '+91 98765 43210';
    const pgEmail = settings?.email || 'srisaigentspg78@gmail.com';

    sendPaymentReceiptEmail({
      residentEmail: resident.email,
      residentName: resident.fullName,
      paymentId,
      billingMonth: pData.billingMonth,
      amountPaid: pData.amountPaid,
      totalDue: pData.totalDueForMonth,
      remainingBalance: remaining,
      paymentMethod: pData.paymentMethod || 'UPI',
      transactionReference: pData.transactionReference,
      pgName,
      pgLogo,
      pgAddress,
      pgContact,
      pgEmail,
    }).catch((err) => console.error('[Resend Payment Receipt Error]:', err));

    res.json({ success: true, payment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 10. Rules Endpoints
// ==========================================
app.post('/api/rules', async (req, res) => {
  try {
    const { title, description, category, isMandatory } = req.body;
    const id = `rul-${Date.now()}`;
    const order = (await RuleModel.countDocuments()) + 1;
    const rule = await RuleModel.create({ id, title, description, category, order, isMandatory });
    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/rules/:id', async (req, res) => {
  try {
    const rule = await RuleModel.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  try {
    await RuleModel.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 11. Storage & Notifications Endpoints
// ==========================================
app.get('/api/storage/:id/file', async (req, res) => {
  res.status(404).json({ success: false, error: 'Files are now served directly from Firebase Storage.' });
});

app.delete('/api/storage/:id', async (req, res) => {
  try {
    // If id is a Firebase URL, attempt to delete it
    if (req.params.id && req.params.id.includes('firebasestorage')) {
      await deleteFromStorage(decodeURIComponent(req.params.id));
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await NotificationModel.updateOne({ id: req.params.id }, { read: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    await NotificationModel.updateMany({}, { read: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 12. Resend Email Services & Test Trigger
// ==========================================
app.get('/api/pg-logo', async (req, res) => {
  try {
    const settings = await SettingModel.findOne().lean();
    if (!settings?.logo) {
      return res.status(404).send('No logo configured');
    }
    const match = settings.logo.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const imgBuffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(imgBuffer);
    }
    if (settings.logo.startsWith('http://') || settings.logo.startsWith('https://')) {
      return res.redirect(settings.logo);
    }
    return res.status(404).send('Invalid logo format');
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

app.post('/api/otp/send', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanEmail, { otp, expiresAt });

    const settings = await SettingModel.findOne().lean();
    const pgName = settings?.name || 'Sri Sai Gents PG';
    const pgLogo = settings?.logo || '';
    const pgAddress = settings?.address || '';
    const pgContact = settings?.contactNumber || settings?.phone || '+91 98765 43210';
    const pgEmail = settings?.email || 'srisaigentspg78@gmail.com';

    const emailRes = await sendEmailOtp({
      email: cleanEmail,
      otp,
      name,
      pgName,
      pgLogo,
      pgAddress,
      pgContact,
      pgEmail,
    });

    if (!emailRes.success) {
      console.warn('[OTP Email Error, using fallback response]:', emailRes.error);
      return res.json({
        success: true,
        otp,
        isOfflineFallback: true,
        message: `OTP generated (${otp}). Notice: ${emailRes.error || 'Check inbox'}`,
      });
    }

    res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();
    const entry = otpStore.get(cleanEmail);

    if (!entry) {
      return res.status(400).json({ success: false, error: 'No active OTP found. Please request a new code.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(cleanEmail);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new code.' });
    }

    if (entry.otp !== cleanOtp) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please check and retry.' });
    }

    otpStore.delete(cleanEmail);
    res.json({ success: true, verified: true, message: 'Email verified successfully!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/emails/send', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: 'to, subject, and html are required' });
    }

    const result = await sendEmail({ to, subject, html, from });
    if (!result.success) {
      return res.status(500).json(result);
    }

    // Log notification
    await NotificationModel.create({
      id: `notif_${Date.now()}`,
      title: `Email Sent: ${subject}`,
      message: `Email successfully delivered to ${Array.isArray(to) ? to.join(', ') : to}`,
      type: 'system',
      timestamp: new Date().toISOString(),
      read: false,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/emails/test', async (req, res) => {
  try {
    const targetEmail = req.body.to || process.env.GMAIL_USER || 'srisaigentspg78@gmail.com';
    const result = await sendEmail({
      to: targetEmail,
      subject: 'PG Management System - Live Email Delivery Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Email System Operational!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your PG Management System email engine is active and ready to deliver OTPs, onboarding reference IDs, and payment receipts.
          </p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Status:</strong> Live & Operational</p>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #334155;"><strong>Recipient:</strong> ${targetEmail}</p>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #334155;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">
            Automated alerts, tenant onboarding verification OTPs, and payment receipts are now delivered directly.
          </p>
        </div>
      `,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/emails/rent-due-reminder', async (req, res) => {
  try {
    const {
      residentEmail,
      residentName,
      roomNumber,
      bedNumber,
      billingMonth,
      dueAmount,
      totalRent,
      dueDate,
      pgName,
      pgContact,
      upiId,
      adminEmail,
    } = req.body;

    if (!residentName || !dueAmount) {
      return res.status(400).json({ success: false, error: 'residentName and dueAmount are required' });
    }

    const settings = await SettingModel.findOne();
    const resolvedPgName = pgName || settings?.name || 'Sri Sai Gents PG';
    const resolvedPgLogo = settings?.logo || '';
    const resolvedPgAddress = settings?.address || '';
    const resolvedPgContact = pgContact || settings?.contactNumber || settings?.phone || '+91 98765 43210';
    const resolvedPgEmail = settings?.email || 'srisaigentspg78@gmail.com';
    const resolvedUpiId = upiId || settings?.upiId;

    const emailResult = await sendRentDueReminderEmail({
      residentEmail,
      residentName,
      roomNumber: roomNumber || 'N/A',
      bedNumber: bedNumber || 'N/A',
      billingMonth: billingMonth || 'Current Month',
      dueAmount: Number(dueAmount),
      totalRent: Number(totalRent || dueAmount),
      dueDate: dueDate || '5th of this month',
      pgName: resolvedPgName,
      pgLogo: resolvedPgLogo,
      pgAddress: resolvedPgAddress,
      pgContact: resolvedPgContact,
      pgEmail: resolvedPgEmail,
      upiId: resolvedUpiId,
      adminEmail: adminEmail || resolvedPgEmail,
    });

    // Log notification
    await NotificationModel.create({
      id: `notif_${Date.now()}`,
      title: `Rent Due Reminder: ${residentName}`,
      message: `Due reminder of ₹${dueAmount} (${billingMonth}) dispatched to ${residentEmail || 'Tenant'} and owner alert to ${adminEmail || resolvedPgEmail}`,
      type: 'PAYMENT',
      timestamp: new Date().toISOString(),
      read: false,
    });

    res.json({
      success: emailResult.success,
      tenantSent: emailResult.tenantSent,
      ownerSent: emailResult.ownerSent,
      error: emailResult.error,
      message: emailResult.success
        ? `Rent due reminder email successfully delivered to ${residentEmail ? residentEmail : 'Owner'}`
        : emailResult.error || 'Failed to dispatch email',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Expenses Management Routes
// ==========================================
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await ExpenseModel.find();
    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const expenseData = req.body;
    const id = expenseData.id || `EXP-${Date.now()}`;
    const createdAt = expenseData.createdAt || new Date().toISOString();
    const newExpense = { ...expenseData, id, createdAt };

    await ExpenseModel.create(newExpense);

    broadcastRealtime('EXPENSE_CREATED', newExpense);
    res.status(201).json({ success: true, data: newExpense });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await ExpenseModel.updateOne({ id }, updates);
    broadcastRealtime('EXPENSE_UPDATED', { id, ...updates });
    res.json({ success: true, message: 'Expense updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ExpenseModel.deleteOne({ id });
    broadcastRealtime('EXPENSE_DELETED', { id });
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Vite Middleware / Production Static Serve
// ==========================================
async function startApp() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('[Vite Middleware] Could not load Vite dev server:', err);
    }
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Express] Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startApp();
}

export default app;
