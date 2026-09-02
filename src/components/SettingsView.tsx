import React, { useState, useRef } from 'react';
import {
  Building,
  Phone,
  Mail,
  MapPin,
  Lock,
  HardDrive,
  Save,
  CheckCircle2,
  Send,
  Loader2,
  Database,
  RefreshCw,
  Pencil,
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  ShieldCheck,
  Check,
  CreditCard,
  Calendar,
  Layers,
  HelpCircle,
  AlertCircle,
  ShieldAlert,
  Server,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { PGSettings, PGType } from '../types';
import { SensitiveEditModal } from './SensitiveEditModal';
import { StorageManagerModal } from './StorageManagerModal';
import { compressImageFile } from '../utils/helpers';

const DEFAULT_FEATURE_SUGGESTIONS = [
  'High-Speed Wi-Fi',
  '3 Times Hygienic Food',
  'Daily Housekeeping',
  '24/7 CCTV Security',
  'Power Backup',
  'RO Water Purifier',
  'Hot Water Geyser',
  'Washing Machine',
  'Air Conditioning (AC)',
  'Elevator / Lift',
  'Attached Balcony',
  'Individual Cupboards',
];

export const SettingsView: React.FC = () => {
  const {
    pgSettings,
    updatePGSettings,
    storageFiles,
    totalStorageMb,
    storagePercentage,
    isSyncing,
    lastSyncedAt,
    refreshData,
  } = usePG();

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formData, setFormData] = useState<PGSettings>({
    ...pgSettings,
    features: pgSettings.features || [
      'High-Speed Wi-Fi',
      '3 Times Hygienic Food',
      'Daily Housekeeping',
      '24/7 CCTV Security',
      'Power Backup',
      'RO Water Purifier',
      'Hot Water Geyser',
      'Washing Machine',
    ],
  });

  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);

  // Logo file upload ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCompressingLogo, setIsCompressingLogo] = useState<boolean>(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Feature input state
  const [customFeatureInput, setCustomFeatureInput] = useState<string>('');

  // Email test state
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);

  // Passcode verification for sensitive changes
  const [showSensitiveModal, setShowSensitiveModal] = useState<boolean>(false);
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState<boolean>(false);

  // Handle Logo Upload with compression
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file (PNG, JPG, JPEG, WebP).');
      return;
    }

    setLogoError(null);
    setIsCompressingLogo(true);
    try {
      // Compress logo to < 300KB
      const { dataUrl } = await compressImageFile(file, 300000);
      setFormData((prev) => ({
        ...prev,
        logo: dataUrl,
      }));
    } catch (err: any) {
      setLogoError('Failed to process image. Please try another picture.');
    } finally {
      setIsCompressingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({
      ...prev,
      logo: '',
    }));
  };

  const handleAddFeature = (featureToAdd: string) => {
    const trimmed = featureToAdd.trim();
    if (!trimmed) return;
    const currentFeatures = formData.features || [];
    if (!currentFeatures.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        features: [...currentFeatures, trimmed],
      }));
    }
    setCustomFeatureInput('');
  };

  const handleRemoveFeature = (featureToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      features: (prev.features || []).filter((f) => f !== featureToRemove),
    }));
  };

  const handleStartEdit = () => {
    setFormData({
      ...pgSettings,
      features: pgSettings.features || [
        'High-Speed Wi-Fi',
        '3 Times Hygienic Food',
        'Daily Housekeeping',
        '24/7 CCTV Security',
        'Power Backup',
        'RO Water Purifier',
        'Hot Water Geyser',
        'Washing Machine',
      ],
    });
    setIsEditing(true);
    setIsSaved(false);
  };

  const handleCancelEdit = () => {
    setFormData({ ...pgSettings });
    setIsEditing(false);
    setLogoError(null);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasscodeUnlocked && pgSettings.adminPasscode && pgSettings.adminPasscode !== formData.adminPasscode) {
      setShowSensitiveModal(true);
      return;
    }

    executeSave();
  };

  const executeSave = () => {
    updatePGSettings(formData);
    setIsEditing(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3500);
  };

  const handlePasscodeVerified = () => {
    setIsPasscodeUnlocked(true);
    executeSave();
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await fetch('/api/emails/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: formData.email || 'srisaigentspg78@gmail.com' }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailStatus('Test email sent successfully via Resend with dynamic branding!');
      } else {
        setTestEmailStatus(`Failed: ${data.error || 'Check server logs'}`);
      }
    } catch (err: any) {
      setTestEmailStatus(`Error: ${err.message}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div id="settings-view-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            PG Settings & Configuration
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Property profile, branding logo, contact & helpdesk details, features and security
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSaved && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200 animate-in fade-in shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settings Updated Successfully!</span>
            </div>
          )}

          {!isEditing ? (
            <button
              id="edit-property-settings-btn"
              type="button"
              onClick={handleStartEdit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Property Details</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSaveSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card (View or Edit Mode) */}
        <div className="lg:col-span-2 space-y-6">
          {/* ============================================================ */}
          {/* 1. VIEW MODE (Read-only clean dashboard) */}
          {/* ============================================================ */}
          {!isEditing ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* Header Banner */}
              <div className="p-6 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
                  <div className="flex items-center gap-4">
                    {/* Logo or Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 p-2 flex items-center justify-center shrink-0 backdrop-blur-xs overflow-hidden shadow-inner">
                      {pgSettings.logo ? (
                        <img
                          src={pgSettings.logo}
                          alt={pgSettings.name}
                          className="w-full h-full object-contain rounded-xl"
                        />
                      ) : (
                        <Building className="w-8 h-8 text-indigo-300" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                          {pgSettings.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                          {pgSettings.type} PG
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {pgSettings.tagline || 'Premium Living for Professionals & Students'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="self-start sm:self-center px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* Property Details Grid */}
              <div className="p-6 space-y-6">
                {/* Contact & Helpdesk Information */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Contact & Email Helpdesk
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Phone className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Primary Mobile / WhatsApp</span>
                      </div>
                      <p className="text-sm font-semibold font-mono text-slate-900">
                        {pgSettings.contactNumber || pgSettings.phone || '+91 98765 43210'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Helpdesk Contact (in Emails)</span>
                      </div>
                      <p className="text-sm font-semibold font-mono text-slate-900">
                        {pgSettings.helpdeskContact || pgSettings.contactNumber || '+91 98765 43210'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Official / Admin Email</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {pgSettings.email}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Mail className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Helpdesk Email (in Emails)</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                        {pgSettings.helpdeskEmail || pgSettings.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Location & Address */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Physical Address & Location
                  </h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                        {pgSettings.address}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        {pgSettings.city && <span>City: {pgSettings.city}</span>}
                        {pgSettings.pincode && <span>Pincode: {pgSettings.pincode}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial & Billing */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Payment & Billing Policy
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-500 block">Rent Collection UPI ID</span>
                        <span className="text-xs font-semibold font-mono text-slate-900">
                          {pgSettings.upiId || 'abcpg@okaxis'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-500 block">Monthly Rent Due Day</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {pgSettings.monthlyDueDay || 5}th of every month
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features & Amenities */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Key Features & Amenities
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(pgSettings.features && pgSettings.features.length > 0
                      ? pgSettings.features
                      : DEFAULT_FEATURE_SUGGESTIONS.slice(0, 8)
                    ).map((feat, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-indigo-50/80 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>{feat}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Description */}
                {pgSettings.description && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Property Description
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      {pgSettings.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* 2. EDIT MODE (Interactive form to update all details)        */
            /* ============================================================ */
            <form
              onSubmit={handleSaveSubmit}
              className="bg-white rounded-2xl p-6 border border-indigo-200 shadow-sm space-y-6"
            >
              {/* Form Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Edit Property Details</h3>
                    <p className="text-xs text-slate-500">
                      Update property profile, branding logo, features, and contact details
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>

              {/* 1. PG LOGO UPLOAD SECTION */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    <span>PG Branding Logo</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Appears in Resident Welcome & Verification Emails
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Logo Preview */}
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-2 flex items-center justify-center shrink-0 relative group">
                    {formData.logo ? (
                      <>
                        <img
                          src={formData.logo}
                          alt="PG Logo Preview"
                          className="w-full h-full object-contain rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow-sm hover:bg-rose-700 transition"
                          title="Remove Logo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center">
                        <Building className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                        <span className="text-[9px] text-slate-400 font-medium block">No Logo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-2 text-left w-full sm:w-auto">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressingLogo}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-2 shadow-2xs transition cursor-pointer"
                      >
                        {isCompressingLogo ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            <span>Processing Logo...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{formData.logo ? 'Change Logo' : 'Upload PG Logo'}</span>
                          </>
                        )}
                      </button>

                      {formData.logo && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal">
                      Upload transparent PNG or JPEG. If left empty, a clean property header will be used in emails automatically.
                    </p>

                    {logoError && (
                      <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{logoError}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. BASIC PROFILE FIELDS */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      PG / Property Name *
                    </label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Sri Sai Luxury Gents PG"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">PG Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as PGType })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    >
                      <option value="Gents">Gents PG</option>
                      <option value="Ladies">Ladies PG</option>
                      <option value="Co-ed">Co-ed / Mixed PG</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Title / Tagline
                  </label>
                  <input
                    value={formData.tagline || ''}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    placeholder="e.g. Premium Stay for Professionals & Students"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              {/* 3. CONTACT & HELPDESK INFO */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Contact & Email Details</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Primary Mobile / WhatsApp *
                    </label>
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={formData.contactNumber || formData.phone || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, contactNumber: val, phone: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Helpdesk / Support Phone (for Emails)
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="Helpdesk phone number"
                      value={formData.helpdeskContact || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          helpdeskContact: e.target.value.replace(/\D/g, '').slice(0, 10),
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Official Admin Email *
                    </label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. srisaigentspg78@gmail.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Helpdesk Support Email (in Emails Footer)
                    </label>
                    <input
                      type="email"
                      value={formData.helpdeskEmail || ''}
                      onChange={(e) => setFormData({ ...formData, helpdeskEmail: e.target.value })}
                      placeholder="Support email address"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* 4. ADDRESS & LOCATION */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Physical Address (Printed on Emails & Receipts)</span>
                </h4>

                <div>
                  <textarea
                    required
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="#42, 4th Cross, 7th Main, Koramangala 4th Block..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                    <input
                      value={formData.city || ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Bengaluru"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="6-digit pincode"
                      value={formData.pincode || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* 5. UPI ID & RENT SCHEDULE */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Rent Collection & Schedule</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Rent Collection UPI ID
                    </label>
                    <input
                      type="text"
                      value={formData.upiId || ''}
                      onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                      placeholder="e.g. srisaigents@okaxis"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Monthly Rent Due Day (1 - 28)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={formData.monthlyDueDay === 0 || formData.monthlyDueDay === undefined ? '' : formData.monthlyDueDay}
                      onChange={(e) =>
                        setFormData({ ...formData, monthlyDueDay: e.target.value === '' ? ('' as any) : Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* 6. FEATURES / AMENITIES */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>PG Amenities & Features</span>
                </h4>

                {/* Feature Chips */}
                <div className="flex flex-wrap gap-2">
                  {(formData.features || []).map((feat, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-800 rounded-full text-xs font-medium flex items-center gap-1.5 border border-indigo-200/60"
                    >
                      <span>{feat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(feat)}
                        className="text-indigo-400 hover:text-indigo-800 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Custom Feature Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFeatureInput}
                    onChange={(e) => setCustomFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature(customFeatureInput);
                      }
                    }}
                    placeholder="Type custom amenity and hit Enter (e.g. Gym, Terrace Garden)..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddFeature(customFeatureInput)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition"
                  >
                    + Add
                  </button>
                </div>

                {/* Quick Add Suggestions */}
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Quick Suggestions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_FEATURE_SUGGESTIONS.filter(
                      (f) => !(formData.features || []).includes(f)
                    ).map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddFeature(sug)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-medium transition cursor-pointer"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 7. PROPERTY DESCRIPTION */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Property Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your PG amenities, rules, food timings, and highlights..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              {/* 8. SECURITY PASSCODE */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Admin Sensitive Passcode</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Used for destructive modifications and unlocking sensitive resident details. (Default: 6565)
                </p>
                <div className="max-w-xs">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={formData.adminPasscode || formData.editPassword || '6565'}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setFormData({ ...formData, adminPasscode: val, editPassword: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-widest text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              {/* Form Bottom Save Action */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Storage & System Diagnostics */}
        <div className="space-y-4">
          {/* Firebase Database & Real-Time Sync Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Firebase Database</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Live Connected
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Real-time Server-Sent Events stream active. Multi-device onboarding, bed allocation, and payment records sync across all open browsers.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-emerald-600">Online (Real-Time SSE)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Synced:</span>
                <span className="font-mono text-slate-700">
                  {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : 'Connected'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshData(true)}
              disabled={isSyncing}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isSyncing ? 'Synchronizing State...' : 'Sync Database Now'}</span>
            </button>
          </div>

          {/* Gmail SMTP & Resend Email Configuration Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>Gmail & Resend Email Service</span>
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Active & Branded
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Emails will include your configured <strong>PG Logo</strong>, <strong>Address</strong>, and <strong>Helpdesk Contact</strong> automatically.
            </p>
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Sender Account:</span>
                <span className="font-mono font-medium text-slate-700 truncate max-w-[170px]">
                  {pgSettings.email || 'srisaigentspg78@gmail.com'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branding Logo:</span>
                <span className="font-semibold text-emerald-600">
                  {pgSettings.logo ? '✓ Custom Logo Attached' : 'Default Clean Header'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail}
              className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-200 transition disabled:opacity-60 cursor-pointer"
            >
              {sendingTestEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Test Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Verification Email</span>
                </>
              )}
            </button>
            {testEmailStatus && (
              <p
                className={`text-[11px] font-medium mt-1 ${
                  testEmailStatus.startsWith('Test email sent')
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {testEmailStatus}
              </p>
            )}
          </div>

          {/* Storage Quota Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              <span>Storage Usage</span>
            </h3>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Occupied Storage</span>
                <span className="font-bold text-slate-900">
                  {totalStorageMb.toFixed(1)} MB / {pgSettings.storageLimitMb || 500} MB
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{
                    width: `${Math.min(100, storagePercentage)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {storageFiles.length} KYC documents & photos saved. All uploaded images are compressed under 1MB.
              </p>
            </div>

            <button
              onClick={() => setShowStorageModal(true)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Open Storage Manager
            </button>
          </div>

          {/* Production Data Persistence Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs text-slate-600 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <span>Production Data Mode Active</span>
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-500">
              All resident details, bed allocations, KYC documents, and payment records are synchronized live with Firebase and locally cached for high reliability.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>Connected to: <span className="font-semibold text-slate-700">Firebase Firestore</span></span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Real-Time Streams:</span>
              <span className="font-semibold text-emerald-600">SSE Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitive verification modal */}
      <SensitiveEditModal
        isOpen={showSensitiveModal}
        onClose={() => setShowSensitiveModal(false)}
        onVerified={handlePasscodeVerified}
      />

      {/* Storage modal */}
      <StorageManagerModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
      />
    </div>
  );
};
