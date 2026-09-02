import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  PGSettings,
  Building,
  Floor,
  Room,
  Resident,
  ResidentApplication,
  PaymentRecord,
  PaymentStatus,
  Rule,
  NotificationItem,
  StorageFile,
  AuditLog,
  BedStatus,
  ResidentStatus,
  PaymentMethod,
  PaymentType,
  SharingType,
  Expense,
} from '../types';
import {
  initialPGSettings,
  initialBuildings,
  initialFloors,
  initialRooms,
  initialResidents,
  initialApplications,
  initialPayments,
  initialRules,
  initialStorageFiles,
  initialNotifications,
  initialAuditLogs,
  initialExpenses,
} from '../data/initialData';
import { api } from '../services/api';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage';

interface AllocationData {
  buildingId: string;
  floorId: string;
  roomId: string;
  bedId: string;
  monthlyRent: number;
  securityDeposit: number;
  moveInDate: string;
  notes?: string;
}

export interface PaymentSubmissionData {
  residentId: string;
  billingMonth: string;
  totalDueForMonth: number;
  amountPaid: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  notes?: string;
}

interface PGContextType {
  pgSettings: PGSettings;
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  residents: Resident[];
  applications: ResidentApplication[];
  payments: PaymentRecord[];
  rules: Rule[];
  notifications: NotificationItem[];
  storageFiles: StorageFile[];
  auditLogs: AuditLog[];
  activeView: string;
  selectedResidentId: string | null;
  selectedApplicationId: string | null;
  tenantPortalResidentId: string | null;
  onboardingToken: string | null;
  isPublicPortalMode: boolean;
  isDbOnline: boolean;
  isLoadingDb: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  realtimeConnected: boolean;
  refreshData: (showIndicator?: boolean) => Promise<void>;

  // Storage metrics
  totalStorageBytes: number;
  totalStorageMb: number;
  storagePercentage: number;
  storageStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'FULL';
  isStorageFull: boolean;

  // View navigation
  setActiveView: (view: string) => void;
  setSelectedResidentId: (id: string | null) => void;
  setSelectedApplicationId: (id: string | null) => void;
  setTenantPortalResidentId: (id: string | null) => void;
  setOnboardingToken: (token: string | null) => void;
  setIsAdminLoggedIn: (val: boolean) => void;
  setPublicPortalMode: (val: boolean) => void;

  // Auth
  isAdminLoggedIn: boolean;
  loginAdmin: (username: string, password: string) => Promise<boolean> | boolean;
  logoutAdmin: () => void;

  // Actions
  updatePGSettings: (settings: Partial<PGSettings>) => void;
  addBuilding: (name: string, description?: string) => string;
  editBuilding: (id: string, name: string, description?: string) => void;
  deleteBuilding: (id: string, forceCascade?: boolean) => Promise<{ success: boolean; error?: string }>;
  addFloor: (buildingId: string, name: string) => string;
  deleteFloor: (id: string) => boolean;
  addRoom: (
    buildingId: string,
    floorId: string,
    roomNumber: string,
    sharingType: SharingType,
    capacity: number,
    baseRent: number
  ) => void;
  editRoom: (roomId: string, updates: Partial<Room>) => void;
  deleteRoom: (roomId: string) => boolean;
  updateBedStatus: (bedId: string, status: BedStatus) => void;

  generateInvitationLink: () => { token: string; link: string };
  submitApplication: (application: Omit<ResidentApplication, 'id' | 'status' | 'submittedAt'>) => Promise<string>;
  approveApplication: (applicationId: string, allocation: AllocationData) => { residentId: string; resident: Resident };
  rejectApplication: (applicationId: string, reason: string) => void;
  requestCorrection: (applicationId: string, note: string) => void;

  updateResident: (residentId: string, updates: Partial<Resident>) => void;
  changeResidentStatus: (residentId: string, status: ResidentStatus, noticeDate?: string, vacatedDate?: string) => void;
  unvacateResident: (residentId: string, allocation?: { roomId: string; bedId: string }) => boolean;

  recordPayment: (payment: PaymentSubmissionData) => PaymentRecord;
  verifyAdminPassword: (password: string) => boolean;

  addRule: (rule: Omit<Rule, 'id' | 'order'>) => void;
  updateRule: (ruleId: string, updates: Partial<Rule>) => void;
  deleteRule: (ruleId: string) => void;
  reorderRules: (rules: Rule[]) => void;

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  addNotification: (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  triggerPaymentReminders: () => number;

  deleteStorageFile: (fileId: string) => void;
  cleanDemoData: () => Promise<void>;
  resetToDemoData: () => void;
}

const PGContext = createContext<PGContextType | null>(null);

const STORAGE_KEYS = {
  SETTINGS: 'abcdef_pg_settings',
  BUILDINGS: 'abcdef_pg_buildings',
  FLOORS: 'abcdef_pg_floors',
  ROOMS: 'abcdef_pg_rooms',
  RESIDENTS: 'abcdef_pg_residents',
  APPLICATIONS: 'abcdef_pg_applications',
  PAYMENTS: 'abcdef_pg_payments',
  RULES: 'abcdef_pg_rules',
  NOTIFICATIONS: 'abcdef_pg_notifications',
  EXPENSES: 'abcdef_pg_expenses',
  STORAGE_FILES: 'abcdef_pg_storage_files',
  AUDIT_LOGS: 'abcdef_pg_audit_logs',
  ADMIN_AUTH: 'abcdef_pg_admin_auth',
};

export const PGProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pgSettings, setPgSettings] = useState<PGSettings>(() =>
    safeGetItem(STORAGE_KEYS.SETTINGS, initialPGSettings)
  );

  const [buildings, setBuildings] = useState<Building[]>(() =>
    safeGetItem(STORAGE_KEYS.BUILDINGS, initialBuildings)
  );

  const [floors, setFloors] = useState<Floor[]>(() =>
    safeGetItem(STORAGE_KEYS.FLOORS, initialFloors)
  );

  const [rooms, setRooms] = useState<Room[]>(() =>
    safeGetItem(STORAGE_KEYS.ROOMS, initialRooms)
  );

  const [residents, setResidents] = useState<Resident[]>(() =>
    safeGetItem(STORAGE_KEYS.RESIDENTS, initialResidents)
  );

  const [applications, setApplications] = useState<ResidentApplication[]>(() =>
    safeGetItem(STORAGE_KEYS.APPLICATIONS, initialApplications)
  );

  const [payments, setPayments] = useState<PaymentRecord[]>(() =>
    safeGetItem(STORAGE_KEYS.PAYMENTS, initialPayments)
  );

  const [rules, setRules] = useState<Rule[]>(() =>
    safeGetItem(STORAGE_KEYS.RULES, initialRules)
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    safeGetItem(STORAGE_KEYS.NOTIFICATIONS, initialNotifications)
  );

  const [storageFiles, setStorageFiles] = useState<StorageFile[]>(() =>
    safeGetItem(STORAGE_KEYS.STORAGE_FILES, initialStorageFiles)
  );

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    safeGetItem(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs)
  );

  const [expenses, setExpenses] = useState<Expense[]>(() =>
    safeGetItem(STORAGE_KEYS.EXPENSES, initialExpenses)
  );

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.EXPENSES, expenses);
  }, [expenses]);

  // UI state
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [tenantPortalResidentId, setTenantPortalResidentId] = useState<string | null>(null);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);
      const queryToken = urlParams.get('join') || urlParams.get('invite') || urlParams.get('token');
      if (pathname.includes('/join') || pathname.includes('/invite')) {
        return 'invitation';
      }
      return queryToken;
    }
    return null;
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return safeGetItem<string>(STORAGE_KEYS.ADMIN_AUTH, 'false') === 'true';
  });
  const [isPublicPortalMode, setPublicPortalMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      return (
        pathname.includes('/join') ||
        pathname.includes('/invite') ||
        pathname.includes('/onboard') ||
        pathname.includes('/portal') ||
        search.includes('join') ||
        search.includes('invite') ||
        search.includes('token') ||
        search.includes('portal') ||
        hash.includes('join') ||
        hash.includes('invite')
      );
    }
    return false;
  });
  const [isDbOnline, setIsDbOnline] = useState<boolean>(true);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);

  const loginAdmin = async (usernameInput: string, passwordInput: string): Promise<boolean> => {
    const userClean = usernameInput.trim().toLowerCase();
    const passClean = passwordInput.trim();
    const allowedPasswords = ['@srisaigentspg', 'Arshad.com', 'srisaigentspg'];

    if (
      userClean === 'admin' &&
      (allowedPasswords.includes(passClean) || passClean === (pgSettings.editPassword || '6565'))
    ) {
      setIsAdminLoggedIn(true);
      safeSetItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
      logAudit('ADMIN_LOGIN', 'admin', 'Admin logged into control panel');
      api.loginAdmin(userClean, passClean).catch(() => {});
      return true;
    }

    const apiSuccess = await api.loginAdmin(userClean, passClean);
    if (apiSuccess) {
      setIsAdminLoggedIn(true);
      safeSetItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
      logAudit('ADMIN_LOGIN', 'admin', 'Admin logged into control panel');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdminLoggedIn(false);
    safeRemoveItem(STORAGE_KEYS.ADMIN_AUTH);
    logAudit('ADMIN_LOGOUT', 'admin', 'Admin logged out');
  };

  // Dedicated MongoDB Health Monitor
  useEffect(() => {
    let isMounted = true;
    const checkDbHealth = async () => {
      try {
        const health = await api.checkHealth();
        if (isMounted) {
          if (health) {
            setIsDbOnline(health.mongoDbConnected);
          } else {
            setIsDbOnline(false);
          }
        }
      } catch {
        if (isMounted) setIsDbOnline(false);
      }
    };

    checkDbHealth();
    const interval = setInterval(checkDbHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Reusable refresh function for real-time synchronization
  const refreshData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setIsSyncing(true);
    try {
      const bootstrap = await api.getBootstrapData();
      if (bootstrap) {
        setIsDbOnline(true);
        if (bootstrap.pgSettings) setPgSettings(bootstrap.pgSettings);
        if (bootstrap.buildings) setBuildings(bootstrap.buildings);
        if (bootstrap.floors) setFloors(bootstrap.floors);
        if (bootstrap.rooms) setRooms(bootstrap.rooms);
        if (bootstrap.residents) setResidents(bootstrap.residents);
        if (bootstrap.applications) setApplications(bootstrap.applications);
        if (bootstrap.payments) setPayments(bootstrap.payments);
        if (bootstrap.rules) setRules(bootstrap.rules);
        if (bootstrap.notifications) setNotifications(bootstrap.notifications);
        if (bootstrap.storageFiles) setStorageFiles(bootstrap.storageFiles);
        if (bootstrap.auditLogs) setAuditLogs(bootstrap.auditLogs);
        setLastSyncedAt(new Date());
      }
    } catch {
      // Background sync check handled silently
    } finally {
      if (showIndicator) setIsSyncing(false);
    }
  }, []);

  // 1. Initial Load & MongoDB Sync + Route Detection + SSE Real-Time Stream
  useEffect(() => {
    let mounted = true;

    const initDataAndRoute = async () => {
      // Check URL route for invite / onboarding link
      const pathname = window.location.pathname;
      const search = window.location.search;
      const urlParams = new URLSearchParams(search);

      const joinMatch = pathname.match(/\/(join|invite)(\/.*)?/i);
      const queryToken = urlParams.get('join') || urlParams.get('invite') || urlParams.get('token');
      const isPortalQuery = urlParams.get('portal') === 'true' || pathname.startsWith('/join');

      if (joinMatch || pathname.startsWith('/join') || pathname.startsWith('/invite')) {
        setOnboardingToken('invitation');
        setPublicPortalMode(true);
      } else if (queryToken) {
        setOnboardingToken(queryToken);
        setPublicPortalMode(true);
      } else if (isPortalQuery) {
        setPublicPortalMode(true);
      }

      // Initial Bootstrap Fetch with fail-safe fast load
      try {
        const bootstrap = await api.getBootstrapData();
        if (bootstrap && mounted) {
          setIsDbOnline(true);
          if (bootstrap.pgSettings) setPgSettings(bootstrap.pgSettings);
          if (bootstrap.buildings?.length) setBuildings(bootstrap.buildings);
          if (bootstrap.floors?.length) setFloors(bootstrap.floors);
          if (bootstrap.rooms?.length) setRooms(bootstrap.rooms);
          if (bootstrap.residents) setResidents(bootstrap.residents);
          if (bootstrap.applications) setApplications(bootstrap.applications);
          if (bootstrap.payments) setPayments(bootstrap.payments);
          if (bootstrap.rules?.length) setRules(bootstrap.rules);
          if (bootstrap.notifications) setNotifications(bootstrap.notifications);
          if (bootstrap.storageFiles) setStorageFiles(bootstrap.storageFiles);
          if (bootstrap.auditLogs) setAuditLogs(bootstrap.auditLogs);
          setLastSyncedAt(new Date());
        }
      } catch (e) {
        console.warn('[MongoDB Client] Initial fetch skipped, using cache:', e);
      } finally {
        if (mounted) setIsLoadingDb(false);
      }
    };

    initDataAndRoute();

    // 2. Setup Server-Sent Events (SSE) for instant real-time pushes
    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;
    let sseRetryCount = 0;

    const setupSSE = () => {
      if (typeof window === 'undefined' || !('EventSource' in window)) return;
      if (sseRetryCount > 1) return;

      try {
        eventSource = new EventSource('/api/realtime');

        eventSource.onopen = () => {
          sseRetryCount = 0;
          if (mounted) {
            setRealtimeConnected(true);
            setIsDbOnline(true);
          }
        };

        eventSource.onmessage = (event) => {
          if (!mounted) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'CONNECTED') {
              setRealtimeConnected(true);
              if (parsed.mode === 'polling') {
                eventSource?.close();
              }
            } else {
              // Realtime update received from server! Silently sync state
              refreshData(false);
            }
          } catch {
            // Heartbeat or raw message
          }
        };

        eventSource.onerror = () => {
          sseRetryCount++;
          if (mounted) setRealtimeConnected(false);
          eventSource?.close();
        };
      } catch {
        sseRetryCount++;
        if (mounted) setRealtimeConnected(false);
      }
    };

    setupSSE();

    // 3. Fallback background polling (every 10 seconds) & window focus sync
    const pollInterval = setInterval(() => {
      if (mounted) refreshData(false);
    }, 10000);

    const handleFocus = () => {
      if (mounted) refreshData(false);
    };
    window.addEventListener('focus', handleFocus);

    const handlePopState = () => {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/join') || pathname.startsWith('/invite')) {
        setPublicPortalMode(true);
      } else {
        setPublicPortalMode(false);
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      mounted = false;
      eventSource?.close();
      clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [refreshData]);

  // Synchronize window path when portal mode switches
  useEffect(() => {
    try {
      if (isPublicPortalMode) {
        if (window.location.pathname !== '/join/invitation') {
          window.history.pushState(null, '', '/join/invitation');
        }
      } else {
        if (window.location.pathname.startsWith('/join') || window.location.pathname.startsWith('/invite')) {
          window.history.pushState(null, '', '/');
        }
      }
    } catch {
      // safe fallback in restricted iframe contexts
    }
  }, [isPublicPortalMode]);

  // Sync to safe localStorage (with automatic blob stripping for heavy keys to prevent QuotaExceededError)
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.SETTINGS, pgSettings);
  }, [pgSettings]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.BUILDINGS, buildings);
  }, [buildings]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.FLOORS, floors);
  }, [floors]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.ROOMS, rooms);
  }, [rooms]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.RESIDENTS, residents, true);
  }, [residents]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.APPLICATIONS, applications, true);
  }, [applications]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.PAYMENTS, payments);
  }, [payments]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.RULES, rules);
  }, [rules]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.STORAGE_FILES, storageFiles, true);
  }, [storageFiles]);
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.AUDIT_LOGS, auditLogs);
  }, [auditLogs]);

  // Storage calculations
  const totalStorageBytes = storageFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
  const totalStorageMb = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));
  const storagePercentage = Number(
    Math.min(100, (totalStorageMb / (pgSettings.storageLimitMb || 500)) * 100).toFixed(1)
  );

  let storageStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'FULL' = 'HEALTHY';
  if (storagePercentage >= 100) storageStatus = 'FULL';
  else if (storagePercentage >= 90) storageStatus = 'CRITICAL';
  else if (storagePercentage >= 80) storageStatus = 'WARNING';

  const isStorageFull = storagePercentage >= 100;

  // Helper for adding audit log
  const logAudit = (action: string, target: string, details?: string) => {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      actor: 'Admin',
      target,
      timestamp: new Date().toISOString(),
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Helper for notifications
  const addNotification = (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Settings
  const updatePGSettings = (updates: Partial<PGSettings>) => {
    setPgSettings((prev) => ({ ...prev, ...updates }));
    api.updateSettings(updates);
    logAudit('SETTINGS_UPDATED', 'PG Settings', 'Updated property configuration in MongoDB');
  };

  // Password verification
  const verifyAdminPassword = (password: string): boolean => {
    const valid = password.trim() === (pgSettings.editPassword || '6565');
    if (valid) {
      logAudit('SENSITIVE_EDIT_VERIFIED', 'Security Passcode', 'Admin verified edit authority');
    }
    return valid;
  };

  // Buildings & Floors
  const addBuilding = (name: string, description?: string): string => {
    const id = `bld-${Date.now()}`;
    const newBuilding: Building = { id, name, description };
    setBuildings((prev) => [...prev, newBuilding]);
    const floorId = `flr-${Date.now()}`;
    setFloors((prev) => [...prev, { id: floorId, buildingId: id, name: 'Ground Floor', order: 0 }]);
    api.addBuilding(name, description);
    logAudit('BUILDING_CREATED', name, `Added new building ${name}`);
    return id;
  };

  const editBuilding = (id: string, name: string, description?: string) => {
    setBuildings((prev) => prev.map((b) => (b.id === id ? { ...b, name, description } : b)));
    api.updateBuilding(id, name, description);
    logAudit('BUILDING_UPDATED', name, `Updated building details`);
  };

  const deleteBuilding = async (id: string, forceCascade = false): Promise<{ success: boolean; error?: string }> => {
    // Check if there are active residents in this building
    const hasActiveOccupants = residents.some((res) => res.buildingId === id && res.status !== 'VACATED');
    if (hasActiveOccupants) {
      return {
        success: false,
        error: 'Cannot delete building with active occupants. Please vacate or relocate residents first.',
      };
    }

    const bRooms = rooms.filter((r) => r.buildingId === id);
    if (bRooms.length > 0 && !forceCascade) {
      return {
        success: false,
        error: 'HAS_ROOMS',
      };
    }

    setRooms((prev) => prev.filter((r) => r.buildingId !== id));
    setFloors((prev) => prev.filter((f) => f.buildingId !== id));
    setBuildings((prev) => prev.filter((b) => b.id !== id));

    const res = await api.deleteBuilding(id);
    logAudit('BUILDING_DELETED', id, `Deleted building and removed associated rooms/floors`);
    return { success: res };
  };

  const addFloor = (buildingId: string, name: string): string => {
    const id = `flr-${Date.now()}`;
    const count = floors.filter((f) => f.buildingId === buildingId).length;
    setFloors((prev) => [...prev, { id, buildingId, name, order: count }]);
    api.addFloor(buildingId, name);
    logAudit('FLOOR_CREATED', name, `Added floor to building`);
    return id;
  };

  const deleteFloor = (id: string): boolean => {
    const hasRooms = rooms.some((r) => r.floorId === id);
    if (hasRooms) return false;
    setFloors((prev) => prev.filter((f) => f.id !== id));
    api.deleteFloor(id);
    logAudit('FLOOR_DELETED', id, `Deleted floor`);
    return true;
  };

  // Rooms & Beds
  const addRoom = (
    buildingId: string,
    floorId: string,
    roomNumber: string,
    sharingType: SharingType,
    capacity: number,
    baseRent: number
  ) => {
    const roomId = `rm-${Date.now()}`;
    const beds = Array.from({ length: capacity }, (_, i) => ({
      id: `bed-${roomId}-${i + 1}`,
      roomId,
      bedNumber: `B${i + 1}`,
      status: 'Available' as BedStatus,
    }));

    const newRoom: Room = {
      id: roomId,
      buildingId,
      floorId,
      roomNumber,
      sharingType,
      capacity,
      baseRent,
      status: 'Active',
      beds,
    };

    setRooms((prev) => [...prev, newRoom]);
    api.addRoom(buildingId, floorId, roomNumber, sharingType, capacity, baseRent);
    logAudit('ROOM_CREATED', `Room ${roomNumber}`, `Created ${sharingType} room with ${capacity} beds in MongoDB`);
  };

  const editRoom = (roomId: string, updates: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, ...updates } : r)));
    api.updateRoom(roomId, updates);
    logAudit('ROOM_UPDATED', roomId, `Updated room details`);
  };

  const deleteRoom = (roomId: string): boolean => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return false;
    const hasOccupants = room.beds.some((b) => b.status === 'Occupied');
    if (hasOccupants) return false;

    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    api.deleteRoom(roomId);
    logAudit('ROOM_DELETED', `Room ${room.roomNumber}`, `Deleted room`);
    return true;
  };

  const updateBedStatus = (bedId: string, status: BedStatus) => {
    setRooms((prev) =>
      prev.map((room) => ({
        ...room,
        beds: room.beds.map((b) => {
          if (b.id === bedId) {
            return {
              ...b,
              status,
              ...(status === 'Available' ? { residentId: undefined, residentName: undefined } : {}),
            };
          }
          return b;
        }),
      }))
    );
    api.updateBedStatus(bedId, status);
    logAudit('BED_STATUS_CHANGED', bedId, `Changed bed status to ${status}`);
  };

  // Invitation Link Generation (INVITE TENANT)
  const generateInvitationLink = () => {
    const token = 'invitation';
    const url = `${window.location.origin}/join/invitation`;
    // Also save to MongoDB asynchronously
    api.generateInvitation();
    return { token, link: url };
  };

  // Application Submission
  const submitApplication = async (
    appData: Omit<ResidentApplication, 'id' | 'status' | 'submittedAt'>
  ): Promise<string> => {
    if (isStorageFull) {
      throw new Error('Application storage limit (500 MB) reached. Please contact PG Admin.');
    }

    // Start numeric sequence at 1001
    let maxNum = 1000;
    for (const a of applications) {
      const m = a.id?.match(/(?:APP|RES)[-_]?(\d+)/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val >= 1000 && val < 50000) maxNum = Math.max(maxNum, val);
      }
    }
    for (const r of residents) {
      const m = r.id?.match(/(?:APP|RES)[-_]?(\d+)/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val >= 1000 && val < 50000) maxNum = Math.max(maxNum, val);
      }
    }
    const appId = `APP-${maxNum + 1}`;

    const newApp: ResidentApplication = {
      ...appData,
      id: appId,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
    };

    setApplications((prev) => [newApp, ...prev]);

    // Track Storage file metadata
    if (appData.photoUrl) {
      const photoFile: StorageFile = {
        id: `fil-${Date.now()}-photo`,
        fileName: `${appData.fullName.toLowerCase().replace(/\s+/g, '_')}_photo.jpg`,
        fileType: 'PROFILE_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: appData.photoSizeBytes || 600000,
        sizeMb: Number(((appData.photoSizeBytes || 600000) / (1024 * 1024)).toFixed(2)),
        residentName: `${appData.fullName} (Application)`,
        uploadedAt: new Date().toISOString(),
      };
      setStorageFiles((prev) => [photoFile, ...prev]);
    }

    if (appData.aadharUrl) {
      const aadharFile: StorageFile = {
        id: `fil-${Date.now()}-aadhar`,
        fileName: `${appData.fullName.toLowerCase().replace(/\s+/g, '_')}_aadhaar.jpg`,
        fileType: 'AADHAAR_DOCUMENT',
        mimeType: 'image/jpeg',
        sizeBytes: appData.aadharSizeBytes || 850000,
        sizeMb: Number(((appData.aadharSizeBytes || 850000) / (1024 * 1024)).toFixed(2)),
        residentName: `${appData.fullName} (Application)`,
        uploadedAt: new Date().toISOString(),
      };
      setStorageFiles((prev) => [aadharFile, ...prev]);
    }

    // Persist to MongoDB
    api.submitApplication(appData);

    // Admin alert
    addNotification({
      recipientType: 'ADMIN',
      title: 'New Resident Application Received',
      message: `${appData.fullName} has submitted an onboarding application (${appId}) for review.`,
      channel: 'IN_APP',
      type: 'APPLICATION',
      linkUrl: 'applications',
    });

    logAudit('APPLICATION_SUBMITTED', appData.fullName, `Submitted onboarding application ${appId} to MongoDB`);

    return appId;
  };

  // Application Approval & Bed Allocation
  const approveApplication = (
    applicationId: string,
    allocation: AllocationData
  ): { residentId: string; resident: Resident } => {
    const app = applications.find((a) => a.id === applicationId);
    if (!app) throw new Error('Application not found');

    const targetRoom = rooms.find((r) => r.id === allocation.roomId);
    if (!targetRoom) throw new Error('Selected room not found');

    const targetBed = targetRoom.beds.find((b) => b.id === allocation.bedId);
    if (!targetBed) throw new Error('Selected bed not found');

    // Match Application Reference ID (e.g. APP-1001 -> RES-1001)
    let residentId: string;
    const appNumMatch = app.id.match(/(?:APP)[-_]?(\d+)/i);
    if (appNumMatch) {
      residentId = `RES-${appNumMatch[1]}`;
    } else {
      residentId = `RES-${1000 + residents.length + 1}`;
    }

    const newResident: Resident = {
      id: residentId,
      applicationId: app.id,
      fullName: app.fullName,
      mobile: app.mobile,
      email: app.email,
      gender: app.gender,
      permanentAddress: app.permanentAddress,
      occupation: app.occupation,
      emergencyContact: app.emergencyContact,
      photoUrl: app.photoUrl,
      aadharUrl: app.aadharUrl,
      aadharNumberMasked: app.aadharNumberMasked,
      buildingId: allocation.buildingId,
      floorId: allocation.floorId,
      roomId: allocation.roomId,
      bedId: allocation.bedId,
      roomNumber: targetRoom.roomNumber,
      bedNumber: targetBed.bedNumber,
      sharingType: targetRoom.sharingType,
      moveInDate: allocation.moveInDate,
      monthlyRent: allocation.monthlyRent,
      securityDeposit: allocation.securityDeposit,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      notes: allocation.notes,
    };

    // Update bed to occupied
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== allocation.roomId) return r;
        return {
          ...r,
          beds: r.beds.map((b) =>
            b.id === allocation.bedId
              ? { ...b, status: 'Occupied' as BedStatus, residentId, residentName: app.fullName }
              : b
          ),
        };
      })
    );

    // Update application status
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: 'APPROVED' as const } : a))
    );

    // Add resident
    setResidents((prev) => [newResident, ...prev]);

    // Initial Security Deposit payment record
    if (allocation.securityDeposit > 0) {
      const depositPayment: PaymentRecord = {
        id: `PAY-${Date.now().toString().slice(-4)}`,
        residentId,
        residentName: app.fullName,
        roomNumber: targetRoom.roomNumber,
        bedNumber: targetBed.bedNumber,
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
      };
      setPayments((prev) => [depositPayment, ...prev]);
    }

    // Persist to MongoDB
    api.approveApplication(applicationId, allocation);

    // Notifications
    addNotification({
      recipientType: 'ADMIN',
      residentId,
      title: 'Resident Approved & Allocated',
      message: `${app.fullName} assigned to Room ${targetRoom.roomNumber} (${targetBed.bedNumber}) with Resident ID: ${residentId}.`,
      channel: 'IN_APP',
      type: 'APPROVAL',
      linkUrl: 'residents',
    });

    logAudit(
      'APPLICATION_APPROVED',
      `${app.fullName} (${residentId})`,
      `Approved application and allocated Room ${targetRoom.roomNumber}, Bed ${targetBed.bedNumber}`
    );

    return { residentId, resident: newResident };
  };

  const rejectApplication = (applicationId: string, reason: string) => {
    const app = applications.find((a) => a.id === applicationId);
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, status: 'REJECTED' as const, rejectionReason: reason } : a))
    );
    api.rejectApplication(applicationId, reason);
    if (app) {
      addNotification({
        recipientType: 'TENANT',
        title: 'Application Update',
        message: `Your application for ${pgSettings.name} could not be approved at this time: ${reason}`,
        channel: 'EMAIL',
        type: 'APPLICATION',
      });
      logAudit('APPLICATION_REJECTED', app.fullName, `Reason: ${reason}`);
    }
  };

  const requestCorrection = (applicationId: string, note: string) => {
    const app = applications.find((a) => a.id === applicationId);
    setApplications((prev) =>
      prev.map((a) =>
        a.id === applicationId ? { ...a, status: 'CORRECTION_REQUESTED' as const, correctionNote: note } : a
      )
    );
    api.requestCorrection(applicationId, note);
    if (app) {
      addNotification({
        recipientType: 'TENANT',
        title: 'Information Correction Requested',
        message: `Please update your onboarding application details: ${note}`,
        channel: 'EMAIL',
        type: 'APPLICATION',
      });
      logAudit('CORRECTION_REQUESTED', app.fullName, `Note: ${note}`);
    }
  };

  // Resident profile updates & bed reallocation
  const updateResident = (residentId: string, updates: Partial<Resident>) => {
    setResidents((prev) => {
      const existing = prev.find((r) => r.id === residentId);
      if (!existing) return prev;

      // Handle bed reallocation if room or bed was updated
      if (updates.bedId && updates.bedId !== existing.bedId) {
        setRooms((prevRooms) =>
          prevRooms.map((room) => {
            // 1. Free old bed
            if (room.id === existing.roomId) {
              return {
                ...room,
                beds: room.beds.map((b) =>
                  b.id === existing.bedId
                    ? {
                        ...b,
                        status: 'Available' as BedStatus,
                        residentId: undefined,
                        residentName: undefined,
                      }
                    : b
                ),
              };
            }
            // 2. Occupy new bed
            if (room.id === (updates.roomId || existing.roomId)) {
              return {
                ...room,
                beds: room.beds.map((b) =>
                  b.id === updates.bedId
                    ? {
                        ...b,
                        status: 'Occupied' as BedStatus,
                        residentId,
                        residentName: updates.fullName || existing.fullName,
                      }
                    : b
                ),
              };
            }
            return room;
          })
        );
      }

      return prev.map((r) => (r.id === residentId ? { ...r, ...updates } : r));
    });

    api.updateResident(residentId, updates);
    logAudit('RESIDENT_UPDATED', residentId, `Updated resident profile in MongoDB`);
  };

  const changeResidentStatus = (
    residentId: string,
    status: ResidentStatus,
    noticeDate?: string,
    vacatedDate?: string
  ) => {
    const res = residents.find((r) => r.id === residentId);
    if (!res) return;

    setResidents((prev) =>
      prev.map((r) => {
        if (r.id === residentId) {
          return {
            ...r,
            status,
            ...(noticeDate ? { noticeDate } : {}),
            ...(vacatedDate ? { vacatedDate } : {}),
          };
        }
        return r;
      })
    );

    // If vacated, free the bed
    if (status === 'VACATED') {
      setRooms((prev) =>
        prev.map((room) => ({
          ...room,
          beds: room.beds.map((b) => {
            if (b.id === res.bedId) {
              return { ...b, status: 'Available' as BedStatus, residentId: undefined, residentName: undefined };
            }
            return b;
          }),
        }))
      );
    }

    api.updateResidentStatus(residentId, status, noticeDate, vacatedDate);
    logAudit('RESIDENT_STATUS_CHANGED', `${res.fullName} (${residentId})`, `Status changed to ${status}`);
  };

  // Unvacate / Reactivate Resident (Undo Vacated state and re-admit with active bed)
  const unvacateResident = (
    residentId: string,
    allocation?: { roomId: string; bedId: string }
  ): boolean => {
    const res = residents.find((r) => r.id === residentId);
    if (!res) return false;

    // Determine target room and bed
    let targetRoom = allocation?.roomId ? rooms.find((r) => r.id === allocation.roomId) : rooms.find((r) => r.id === res.roomId);
    let targetBed = allocation?.bedId
      ? targetRoom?.beds.find((b) => b.id === allocation.bedId)
      : targetRoom?.beds.find((b) => b.id === res.bedId && b.status === 'Available');

    // If previous bed is taken or not available, find first available bed
    if (!targetRoom || !targetBed || targetBed.status !== 'Available') {
      for (const r of rooms) {
        const avail = r.beds.find((b) => b.status === 'Available');
        if (avail) {
          targetRoom = r;
          targetBed = avail;
          break;
        }
      }
    }

    if (!targetRoom || !targetBed) {
      alert('Cannot unvacate resident: No available beds found. Please create a room or free up a bed first.');
      return false;
    }

    const roomId = targetRoom.id;
    const bedId = targetBed.id;
    const roomNumber = targetRoom.roomNumber;
    const bedNumber = targetBed.bedNumber;
    const sharingType = targetRoom.sharingType;

    // 1. Mark bed as Occupied
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        return {
          ...r,
          beds: r.beds.map((b) =>
            b.id === bedId
              ? { ...b, status: 'Occupied' as BedStatus, residentId, residentName: res.fullName }
              : b
          ),
        };
      })
    );

    // 2. Update resident status to ACTIVE and reset dates
    setResidents((prev) =>
      prev.map((r) => {
        if (r.id === residentId) {
          return {
            ...r,
            status: 'ACTIVE',
            roomId,
            bedId,
            roomNumber,
            bedNumber,
            sharingType,
            vacatedDate: undefined,
            noticeDate: undefined,
          };
        }
        return r;
      })
    );

    // 3. Persist to MongoDB backend
    api.updateResident(residentId, {
      status: 'ACTIVE',
      roomId,
      bedId,
      roomNumber,
      bedNumber,
      sharingType,
      vacatedDate: undefined,
      noticeDate: undefined,
    });
    api.updateBedStatus(bedId, 'Occupied');

    // 4. Alert and Audit
    addNotification({
      recipientType: 'ADMIN',
      title: 'Resident Reactivated (Unvacated)',
      message: `${res.fullName} has been reactivated to ACTIVE status in Room ${roomNumber} (Bed ${bedNumber}).`,
      channel: 'IN_APP',
      type: 'APPROVAL',
      linkUrl: 'residents',
    });

    logAudit(
      'RESIDENT_REACTIVATED',
      `${res.fullName} (${residentId})`,
      `Reactivated status from Vacated to ACTIVE. Re-allocated to Room ${roomNumber} (${bedNumber})`
    );

    return true;
  };

  // Payments (Full, Partial, Custom)
  const recordPayment = (pData: PaymentSubmissionData): PaymentRecord => {
    const res = residents.find((r) => r.id === pData.residentId);
    if (!res) throw new Error('Resident not found');

    const paymentId = `PAY-${Date.now().toString().slice(-4)}`;
    const remaining = Math.max(0, pData.totalDueForMonth - pData.amountPaid);
    const status: PaymentStatus = remaining === 0 ? 'Paid' : 'Partially Paid';

    const newPayment: PaymentRecord = {
      id: paymentId,
      residentId: res.id,
      residentName: res.fullName,
      roomNumber: res.roomNumber,
      bedNumber: res.bedNumber,
      billingMonth: pData.billingMonth,
      totalDueForMonth: pData.totalDueForMonth,
      amountPaid: pData.amountPaid,
      remainingBalance: remaining,
      paymentType: pData.paymentType,
      paymentMethod: pData.paymentMethod,
      status,
      transactionReference: pData.transactionReference,
      notes: pData.notes,
      paidAt: new Date().toISOString(),
      recordedBy: 'Admin',
    };

    setPayments((prev) => [newPayment, ...prev]);
    api.recordPayment(pData);

    // Admin & Tenant Notifications
    addNotification({
      recipientType: 'ADMIN',
      residentId: res.id,
      title: `Payment Received: ₹${pData.amountPaid.toLocaleString('en-IN')}`,
      message: `Recorded ${status.toLowerCase()} from ${res.fullName} (${res.roomNumber}-${res.bedNumber}). ${
        remaining > 0 ? `Remaining Due: ₹${remaining.toLocaleString('en-IN')}` : 'Full amount cleared.'
      }`,
      channel: 'IN_APP',
      type: 'PAYMENT_RECORDED',
      linkUrl: 'payments',
    });

    logAudit(
      'PAYMENT_RECORDED',
      `${res.fullName} (${paymentId})`,
      `Collected ₹${pData.amountPaid} for ${pData.billingMonth} via ${pData.paymentMethod}. Remaining: ₹${remaining}`
    );

    return newPayment;
  };

  // Rules Management
  const addRule = (ruleData: Omit<Rule, 'id' | 'order'>) => {
    const id = `rul-${Date.now()}`;
    const newRule: Rule = { ...ruleData, id, order: rules.length + 1 };
    setRules((prev) => [...prev, newRule]);
    api.addRule(ruleData);
    logAudit('RULE_CREATED', ruleData.title, 'Created new PG rule in MongoDB');
  };

  const updateRule = (ruleId: string, updates: Partial<Rule>) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
    api.updateRule(ruleId, updates);
    logAudit('RULE_UPDATED', ruleId, 'Updated PG rule in MongoDB');
  };

  const deleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    api.deleteRule(ruleId);
    logAudit('RULE_DELETED', ruleId, 'Removed PG rule from MongoDB');
  };

  const reorderRules = (newRules: Rule[]) => {
    setRules(newRules);
  };

  // Storage
  const deleteStorageFile = (fileId: string) => {
    setStorageFiles((prev) => prev.filter((f) => f.id !== fileId));
    api.deleteStorageFile(fileId);
    logAudit('STORAGE_FILE_DELETED', fileId, 'Deleted KYC document from storage');
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.markNotificationAsRead(id);
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsAsRead();
  };

  const triggerPaymentReminders = (): number => {
    const activeResidents = residents.filter((r) => r.status === 'ACTIVE');
    let count = 0;

    activeResidents.forEach((res) => {
      const resPayments = payments.filter((p) => p.residentId === res.id && p.billingMonth === 'August 2026');
      const paid = resPayments.reduce((acc, p) => acc + p.amountPaid, 0);
      const remaining = Math.max(0, res.monthlyRent - paid);

      if (remaining > 0) {
        // Notification for Tenant
        addNotification({
          recipientType: 'TENANT',
          residentId: res.id,
          title: `Monthly Rent Due: ₹${remaining.toLocaleString('en-IN')}`,
          message: `Dear ${res.fullName}, your rent for August 2026 has a pending balance of ₹${remaining.toLocaleString(
            'en-IN'
          )}. Kindly clear it by 5th.`,
          channel: 'EMAIL',
          type: 'PAYMENT_DUE',
        });

        // Notification for Admin / Owner
        addNotification({
          recipientType: 'ADMIN',
          residentId: res.id,
          title: `Rent Due Alert: ${res.fullName} (₹${remaining.toLocaleString('en-IN')})`,
          message: `${res.fullName} (Room ${res.roomNumber}, Bed ${res.bedNumber}) has a pending rent balance of ₹${remaining.toLocaleString(
            'en-IN'
          )} for August 2026.`,
          channel: 'IN_APP',
          type: 'PAYMENT_DUE',
        });

        // Trigger email reminder if email is registered
        if (res.email) {
          fetch('/api/emails/rent-due-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              residentEmail: res.email,
              residentName: res.fullName,
              roomNumber: res.roomNumber,
              bedNumber: res.bedNumber,
              billingMonth: 'August 2026',
              dueAmount: remaining,
              totalRent: res.monthlyRent,
              dueDate: '5th of this month',
              pgName: pgSettings.name,
              pgContact: pgSettings.phone,
              upiId: pgSettings.bankDetails?.upiId,
              adminEmail: pgSettings.email,
            }),
          }).catch((err) => console.error('Error triggering rent due email:', err));
        }

        count++;
      }
    });

    logAudit('PAYMENT_REMINDERS_TRIGGERED', 'Batch Broadcast', `Sent automated rent due reminders to ${count} residents and alerted owner`);
    return count;
  };

  const cleanDemoData = async () => {
    setResidents([]);
    setApplications([]);
    setPayments([]);
    setStorageFiles([]);
    setNotifications([]);
    setAuditLogs([]);
    // Remove test buildings and floors
    setBuildings((prev) => prev.filter((b) => !b.name.toLowerCase().includes('test')));
    setFloors((prev) => prev.filter((f) => !f.name.toLowerCase().includes('test')));
    setRooms((prev) =>
      prev
        .filter((r) => !r.roomNumber.toLowerCase().includes('test'))
        .map((r) => ({
          ...r,
          beds: r.beds.map((b) => ({
            ...b,
            status: 'Available' as BedStatus,
            residentId: undefined,
            residentName: undefined,
          })),
        }))
    );
    safeRemoveItem(STORAGE_KEYS.RESIDENTS);
    safeRemoveItem(STORAGE_KEYS.APPLICATIONS);
    safeRemoveItem(STORAGE_KEYS.PAYMENTS);
    safeRemoveItem(STORAGE_KEYS.STORAGE_FILES);
    safeRemoveItem(STORAGE_KEYS.NOTIFICATIONS);
    safeRemoveItem(STORAGE_KEYS.AUDIT_LOGS);
    safeRemoveItem(STORAGE_KEYS.BUILDINGS);
    safeRemoveItem(STORAGE_KEYS.FLOORS);
    safeRemoveItem(STORAGE_KEYS.ROOMS);
    await api.cleanDemoData();
    logAudit('DATA_CLEANED', 'Admin', 'Cleared demo data and set system to clean production state');
    await refreshData(false);
  };

  const resetToDemoData = () => {
    setPgSettings(initialPGSettings);
    setBuildings(initialBuildings);
    setFloors(initialFloors);
    setRooms(initialRooms);
    setResidents(initialResidents);
    setApplications(initialApplications);
    setPayments(initialPayments);
    setRules(initialRules);
    setStorageFiles(initialStorageFiles);
    setNotifications(initialNotifications);
    setAuditLogs(initialAuditLogs);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage?.clear();
      }
    } catch {}
    logAudit('SYSTEM_RESET', 'Database', 'Reset all records to initial state');
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    const id = `EXP-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newExpense: Expense = { ...expenseData, id, createdAt };
    setExpenses((prev) => [newExpense, ...prev]);
    api.addExpense(newExpense);
    logAudit('EXPENSE_ADDED', newExpense.title, `Recorded ₹${newExpense.amount} expense (${newExpense.category})`);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)));
    api.updateExpense(id, updates);
    logAudit('EXPENSE_UPDATED', id, `Updated expense details`);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    api.deleteExpense(id);
    logAudit('EXPENSE_DELETED', id, `Deleted expense record`);
  };

  return (
    <PGContext.Provider
      value={{
        pgSettings,
        buildings,
        floors,
        rooms,
        residents,
        applications,
        payments,
        rules,
        notifications,
        storageFiles,
        auditLogs,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        activeView,
        selectedResidentId,
        selectedApplicationId,
        tenantPortalResidentId,
        onboardingToken,
        isAdminLoggedIn,
        loginAdmin,
        logoutAdmin,
        isPublicPortalMode,
        isDbOnline,
        isLoadingDb,
        isSyncing,
        lastSyncedAt,
        realtimeConnected,
        refreshData,
        totalStorageBytes,
        totalStorageMb,
        storagePercentage,
        storageStatus,
        isStorageFull,
        setActiveView,
        setSelectedResidentId,
        setSelectedApplicationId,
        setTenantPortalResidentId,
        setOnboardingToken,
        setIsAdminLoggedIn,
        setPublicPortalMode,
        updatePGSettings,
        addBuilding,
        editBuilding,
        deleteBuilding,
        addFloor,
        deleteFloor,
        addRoom,
        editRoom,
        deleteRoom,
        updateBedStatus,
        generateInvitationLink,
        submitApplication,
        approveApplication,
        rejectApplication,
        requestCorrection,
        updateResident,
        changeResidentStatus,
        unvacateResident,
        recordPayment,
        verifyAdminPassword,
        addRule,
        updateRule,
        deleteRule,
        reorderRules,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNotification,
        triggerPaymentReminders,
        deleteStorageFile,
        cleanDemoData,
        resetToDemoData,
      }}
    >
      {children}
    </PGContext.Provider>
  );
};

export const usePG = (): PGContextType => {
  const context = useContext(PGContext);
  if (!context) throw new Error('usePG must be used within a PGProvider');
  return context;
};
