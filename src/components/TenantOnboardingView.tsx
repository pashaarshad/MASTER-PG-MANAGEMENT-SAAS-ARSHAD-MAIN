import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Camera,
  ShieldCheck,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Upload,
  RefreshCw,
  Eye,
  Check,
  X,
  FileCheck,
  FileText,
  Sparkles,
  KeyRound,
  Copy,
  Clock,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { CameraCaptureModal } from './CameraCaptureModal';
import { ImageCompressionModal } from './ImageCompressionModal';
import {
  maskAadharNumber,
  compressImageFile,
  formatFileSize,
  cleanAadharDigits,
  formatAadharDisplay,
  cleanPhoneDigits,
} from '../utils/helpers';
import { api } from '../services/api';

interface TenantOnboardingViewProps {
  onBackToAdmin?: () => void;
}

export const TenantOnboardingView: React.FC<TenantOnboardingViewProps> = () => {
  const { pgSettings, rules, submitApplication } = usePG();

  // Multi-step progress (Step 1: Personal, Step 2: KYC & Photo, Step 3: Rules & Submit, Step 4: Success)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 1: Personal Details
  const [fullName, setFullName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [occupation, setOccupation] = useState<string>('');
  const [workplace, setWorkplace] = useState<string>('');
  const [permanentAddress, setPermanentAddress] = useState<string>('');

  // Email OTP Verification State
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [otpInput, setOtpInput] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpTimer, setOtpTimer] = useState<number>(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);
  const [fallbackOtpCode, setFallbackOtpCode] = useState<string | null>(null);

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyRelation, setEmergencyRelation] = useState<string>('Parent');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');

  // Step 2: KYC & Photos
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoSize, setPhotoSize] = useState<number>(0);
  const [aadharNumber, setAadharNumber] = useState<string>('');
  const [aadharFrontUrl, setAadharFrontUrl] = useState<string>('');
  const [aadharFrontSize, setAadharFrontSize] = useState<number>(0);
  const [aadharBackUrl, setAadharBackUrl] = useState<string>('');
  const [aadharBackSize, setAadharBackSize] = useState<number>(0);

  // Modals for camera & compression
  const [cameraModalTarget, setCameraModalTarget] = useState<'photo' | 'aadharFront' | 'aadharBack' | null>(null);
  const [compressingFile, setCompressingFile] = useState<File | null>(null);
  const [compressTarget, setCompressTarget] = useState<'photo' | 'aadharFront' | 'aadharBack' | null>(null);

  // Step 3: Rules Acceptance
  const [acceptedRules, setAcceptedRules] = useState<Record<string, boolean>>({});
  const [agreedToAll, setAgreedToAll] = useState<boolean>(false);

  // Step 4: Success Result
  const [submittedAppId, setSubmittedAppId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // OTP Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Reset verification if email changes
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (isEmailVerified) {
      setIsEmailVerified(false);
    }
    if (stepError) setStepError(null);
  };

  // Trigger Send OTP
  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setStepError('Please enter a valid Gmail / Email address first.');
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);
    setStepError(null);
    setOtpSuccessMessage(null);
    setFallbackOtpCode(null);

    try {
      const res = await api.sendEmailOtp(trimmedEmail, fullName.trim());
      if (res.success) {
        setShowOtpModal(true);
        setOtpTimer(30); // 30s resend timer
        setOtpSuccessMessage(res.message || `A 6-digit verification code has been dispatched to ${trimmedEmail}`);
        if (res.otp && res.isOfflineFallback) {
          setFallbackOtpCode(res.otp);
        }
      } else {
        setOtpError(res.error || 'Unable to send OTP email. Please verify your address and retry.');
        setShowOtpModal(true);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Error communicating with OTP service.');
      setShowOtpModal(true);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Trigger Verify OTP
  const handleVerifyOtp = async () => {
    const cleanOtp = otpInput.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setOtpError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await api.verifyEmailOtp(email.trim(), cleanOtp);
      if (res.success && res.verified) {
        setIsEmailVerified(true);
        setShowOtpModal(false);
        setOtpInput('');
        setFallbackOtpCode(null);
        setOtpSuccessMessage('Email verified successfully!');
      } else {
        setOtpError(res.error || 'Invalid verification code. Please check your inbox and try again.');
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Verification failed. Please retry.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle image capture from CameraCaptureModal
  const handleCameraCapture = (param1: File | string, param2?: string | number) => {
    let dataUrl = '';
    let sizeBytes = 120000;

    if (typeof param1 === 'string') {
      dataUrl = param1;
      sizeBytes = typeof param2 === 'number' ? param2 : 120000;
    } else if (param1 instanceof File) {
      dataUrl = typeof param2 === 'string' ? param2 : '';
      sizeBytes = param1.size;
    }

    if (cameraModalTarget === 'photo') {
      setPhotoUrl(dataUrl);
      setPhotoSize(sizeBytes);
    } else if (cameraModalTarget === 'aadharFront') {
      setAadharFrontUrl(dataUrl);
      setAadharFrontSize(sizeBytes);
    } else if (cameraModalTarget === 'aadharBack') {
      setAadharBackUrl(dataUrl);
      setAadharBackSize(sizeBytes);
    }
    setCameraModalTarget(null);
  };

  // Handle direct file upload with auto-compression under 500 KB
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'photo' | 'aadharFront' | 'aadharBack') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If file > 500 KB, open compression modal, otherwise auto-compress quietly
    if (file.size > 500 * 1024) {
      setCompressTarget(target);
      setCompressingFile(file);
    } else {
      try {
        const compressed = await compressImageFile(file, 480000);
        if (target === 'photo') {
          setPhotoUrl(compressed.dataUrl);
          setPhotoSize(compressed.sizeBytes);
        } else if (target === 'aadharFront') {
          setAadharFrontUrl(compressed.dataUrl);
          setAadharFrontSize(compressed.sizeBytes);
        } else if (target === 'aadharBack') {
          setAadharBackUrl(compressed.dataUrl);
          setAadharBackSize(compressed.sizeBytes);
        }
      } catch {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (target === 'photo') {
            setPhotoUrl(dataUrl);
            setPhotoSize(file.size);
          } else if (target === 'aadharFront') {
            setAadharFrontUrl(dataUrl);
            setAadharFrontSize(file.size);
          } else if (target === 'aadharBack') {
            setAadharBackUrl(dataUrl);
            setAadharBackSize(file.size);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleCompressionComplete = (dataUrl: string, compressedSizeBytes: number) => {
    if (compressTarget === 'photo') {
      setPhotoUrl(dataUrl);
      setPhotoSize(compressedSizeBytes);
    } else if (compressTarget === 'aadharFront') {
      setAadharFrontUrl(dataUrl);
      setAadharFrontSize(compressedSizeBytes);
    } else if (compressTarget === 'aadharBack') {
      setAadharBackUrl(dataUrl);
      setAadharBackSize(compressedSizeBytes);
    }
    setCompressingFile(null);
    setCompressTarget(null);
  };

  // Submit Application
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToAll) {
      setStepError('Please check the agreement box to accept all PG rules.');
      return;
    }

    setIsSubmitting(true);
    setStepError(null);

    try {
      const emergencyRel =
        emergencyRelation === 'Parent'
          ? 'Father'
          : (emergencyRelation as any);

      const appId = await submitApplication({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        dob,
        gender,
        occupation: occupation.trim() + (workplace ? ` at ${workplace.trim()}` : ''),
        permanentAddress: permanentAddress.trim(),
        emergencyContact: {
          name: emergencyName.trim(),
          relationship: emergencyRel,
          phone: emergencyPhone.trim(),
        },
        photoUrl:
          photoUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.trim() || 'Tenant')}&background=4f46e5&color=fff&size=256`,
        photoSizeBytes: photoSize || 120000,
        aadharNumberMasked: maskAadharNumber(aadharNumber),
        aadharUrl:
          aadharFrontUrl ||
          'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=80',
        aadharSizeBytes: aadharFrontSize || 250000,
        acceptedRulesVersion: 'v1.0 (Aug 2026)',
        acceptedAt: new Date().toISOString(),
      });

      setSubmittedAppId(appId);
      setCurrentStep(4);
    } catch (err: any) {
      setStepError(err.message || 'Error submitting application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16 font-sans">
      {/* Top Banner & PG Header */}
      <div className="bg-slate-900 text-white shadow-md">
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pgSettings.logo ? (
                <img
                  src={pgSettings.logo}
                  alt={pgSettings.name}
                  className="w-11 h-11 rounded-xl object-contain bg-white p-1 shadow-sm shrink-0 border border-slate-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-xs shrink-0">
                  PG
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-bold leading-tight tracking-tight">
                  {pgSettings.name}
                </h1>
                <p className="text-xs text-slate-300">Join Invitation & Onboarding Portal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-xl mx-auto px-4 mt-6">
        {/* Step-wide Error Banner */}
        {stepError && (
          <div className="p-3.5 bg-red-50 text-red-700 text-xs rounded-2xl border border-red-200 mb-5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium">{stepError}</span>
            </div>
            <button
              type="button"
              onClick={() => setStepError(null)}
              className="text-red-500 hover:text-red-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step Indicator (Steps 1 to 3) */}
        {currentStep < 4 && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs mb-6">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span
                className={`flex items-center gap-1.5 ${
                  currentStep === 1 ? 'text-indigo-600 font-bold' : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    currentStep === 1
                      ? 'bg-indigo-600 text-white'
                      : currentStep > 1
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {currentStep > 1 ? '✓' : '1'}
                </span>
                <span>Personal</span>
              </span>

              <div className="flex-1 h-0.5 bg-slate-100 mx-2" />

              <span
                className={`flex items-center gap-1.5 ${
                  currentStep === 2 ? 'text-indigo-600 font-bold' : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    currentStep === 2
                      ? 'bg-indigo-600 text-white'
                      : currentStep > 2
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {currentStep > 2 ? '✓' : '2'}
                </span>
                <span>KYC & Photo</span>
              </span>

              <div className="flex-1 h-0.5 bg-slate-100 mx-2" />

              <span
                className={`flex items-center gap-1.5 ${
                  currentStep === 3 ? 'text-indigo-600 font-bold' : 'text-slate-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    currentStep === 3
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  3
                </span>
                <span>Rules & Agree</span>
              </span>
            </div>
          </div>
        )}

        {/* STEP 1: Personal & Emergency Contact */}
        {currentStep === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStepError(null);
              if (!fullName.trim() || !mobile.trim() || !email.trim()) {
                setStepError('Please fill all required personal details (Name, Mobile, Gmail).');
                return;
              }
              const cleanMob = cleanPhoneDigits(mobile);
              if (cleanMob.length !== 10) {
                setStepError('Please enter a valid 10-digit mobile number.');
                return;
              }
              const cleanEmerg = cleanPhoneDigits(emergencyPhone);
              if (cleanEmerg.length !== 10) {
                setStepError('Please enter a valid 10-digit emergency contact phone number.');
                return;
              }
              setCurrentStep(2);
            }}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4 animate-in fade-in"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
              <p className="text-xs text-slate-500">Provide accurate legal details for registration</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name (as on Govt ID) *
              </label>
              <input
                required
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Mobile Number (WhatsApp) *
                  </label>
                  <span className={`text-[10px] font-mono ${cleanPhoneDigits(mobile).length === 10 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                    {cleanPhoneDigits(mobile).length}/10 digits
                  </span>
                </div>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="e.g. 9876543210 (10 digits)"
                  value={mobile}
                  onChange={(e) => setMobile(cleanPhoneDigits(e.target.value))}
                  onKeyDown={(e) => {
                    if (
                      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                      (e.ctrlKey || e.metaKey)
                    ) return;
                    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              {/* Email with Verification Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Email / Gmail ID *
                  </label>
                  {isEmailVerified ? (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <Check className="w-3 h-3 text-emerald-600" /> Verified
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Verification recommended
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    required
                    type="email"
                    placeholder="e.g. rahul@gmail.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <button
                    type="button"
                    disabled={isSendingOtp || !email.includes('@')}
                    onClick={handleSendOtp}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer ${
                      isEmailVerified
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50'
                    }`}
                  >
                    {isSendingOtp ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isEmailVerified ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e: any) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Occupation / College
                </label>
                <input
                  placeholder="e.g. Software Engineer / Student"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Workplace / Company
                </label>
                <input
                  placeholder="e.g. Infosys, Manyata Park"
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Permanent Home Address *
              </label>
              <textarea
                required
                rows={2}
                placeholder="House No, Street, City, State, Pincode"
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            {/* Emergency Contact */}
            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Emergency Contact (Parent / Guardian)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Name</label>
                  <input
                    required
                    placeholder="e.g. Suresh Sharma"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Relationship</label>
                  <select
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Friend">Friend</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-600">Phone Number</label>
                    <span className={`text-[10px] font-mono ${cleanPhoneDigits(emergencyPhone).length === 10 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                      {cleanPhoneDigits(emergencyPhone).length}/10
                    </span>
                  </div>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="e.g. 9811223344 (10 digits)"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(cleanPhoneDigits(e.target.value))}
                    onKeyDown={(e) => {
                      if (
                        ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                        (e.ctrlKey || e.metaKey)
                      ) return;
                      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to KYC & Photo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: KYC & Photo (Auto-compressed under 500 KB in KBs) */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in">
            <div>
              <h2 className="text-base font-bold text-slate-900">KYC Verification & Photos</h2>
              <p className="text-xs text-slate-500">
                Camera capture or gallery upload. Auto-compressed under 500 KB.
              </p>
            </div>

            {/* Profile Photo */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Tenant Profile Photo *
                </label>
                {photoSize > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Optimized ({formatFileSize(photoSize)})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Clear face photo for PG register (compressed under 500 KB)</p>

              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <div className="relative">
                    <img
                      src={photoUrl}
                      alt="Profile"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full text-[10px]">
                      ✓
                    </span>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <User className="w-8 h-8" />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraModalTarget('photo')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Live Selfie / Camera</span>
                  </button>

                  <label className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs">
                    <Upload className="w-4 h-4" />
                    <span>Choose from Gallery</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'photo')}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Aadhaar Number */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Aadhaar Card Number *
                </label>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                      cleanAadharDigits(aadharNumber).length === 12
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {cleanAadharDigits(aadharNumber).length} / 12 digits
                  </span>
                  {cleanAadharDigits(aadharNumber).length === 12 && (
                    <span className="text-emerald-600 text-xs font-bold">✓ Valid</span>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={14}
                  placeholder="e.g. 5432 1098 7654 (Numbers only)"
                  value={formatAadharDisplay(aadharNumber)}
                  onChange={(e) => {
                    const onlyDigits = cleanAadharDigits(e.target.value);
                    setAadharNumber(onlyDigits);
                  }}
                  onKeyDown={(e) => {
                    if (
                      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) ||
                      (e.ctrlKey || e.metaKey)
                    ) {
                      return;
                    }
                    if (!/^[0-9]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div className="flex items-center justify-between mt-1 text-[11px]">
                <p className="text-slate-500">
                  Masked representation: <span className="font-mono font-semibold text-slate-700">{maskAadharNumber(aadharNumber)}</span>
                </p>
                {cleanAadharDigits(aadharNumber).length > 0 && cleanAadharDigits(aadharNumber).length < 12 && (
                  <p className="text-amber-600 font-medium">
                    Only numbers allowed • {12 - cleanAadharDigits(aadharNumber).length} digits remaining
                  </p>
                )}
              </div>
            </div>

            {/* Aadhaar Document Upload (Front Side only) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Aadhaar Card Photo / Document (Front Side) *
                </label>
                {aadharFrontSize > 0 ? (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Optimized ({formatFileSize(aadharFrontSize)})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-medium">Clear photo under 500 KB</span>
                )}
              </div>

              {aadharFrontUrl ? (
                <div className="relative">
                  <img
                    src={aadharFrontUrl}
                    alt="Aadhaar Document"
                    className="w-full h-36 object-contain bg-slate-900/5 rounded-lg border border-emerald-300"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      ✓ Document Attached ({formatFileSize(aadharFrontSize)})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAadharFrontUrl('');
                        setAadharFrontSize(0);
                      }}
                      className="text-rose-600 hover:text-rose-700 font-medium underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-28 border-2 border-dashed border-slate-200 bg-white rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                  <FileText className="w-6 h-6 text-slate-300" />
                  <span>Upload Aadhaar Front Photo / Scan (auto-optimized under 500 KB)</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCameraModalTarget('aadharFront')}
                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Camera Photo</span>
                </button>
                <label className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs">
                  <Upload className="w-4 h-4" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'aadharFront')}
                  />
                </label>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setStepError(null);
                  setCurrentStep(1);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={() => {
                  setStepError(null);
                  const cleanAadhar = cleanAadharDigits(aadharNumber);
                  if (!cleanAadhar || cleanAadhar.length !== 12) {
                    setStepError('Please enter your 12-digit Aadhaar Card Number (e.g. 5432 1098 7654).');
                    return;
                  }
                  setCurrentStep(3);
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Rules & Agreement</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Rules & Regulations Acceptance */}
        {currentStep === 3 && (
          <form
            onSubmit={handleSubmitApplication}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4 animate-in fade-in"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {pgSettings.name} Rules & Policies
              </h2>
              <p className="text-xs text-slate-500">
                Please review and accept all mandatory PG hostel regulations
              </p>
            </div>

            {/* Rules list */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {rules.map((r, i) => (
                <div
                  key={r.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {i + 1}. {r.title}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                      {r.category}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>

            {/* Master Acceptance Checkbox */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreedToAll}
                  onChange={(e) => setAgreedToAll(e.target.checked)}
                  className="w-5 h-5 rounded text-indigo-600 mt-0.5 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs text-indigo-950 leading-relaxed font-medium">
                  I hereby confirm that all information provided is true and accurate. I explicitly agree to follow all rules, curfew timings, and payment terms of {pgSettings.name}.
                </span>
              </label>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !agreedToAll}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit KYC Application</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Success & Reference ID & Email Confirmation */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-md text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Application Received!
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                Welcome, {fullName}!
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your onboarding application has been submitted to the management of {pgSettings.name}.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-sm mx-auto text-xs space-y-2.5 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Application Reference ID:</span>
                <div className="flex items-center gap-1.5">
                  <strong className="font-mono text-indigo-700 text-sm font-black">{submittedAppId}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(submittedAppId);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                    title="Copy Reference ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mobile Number:</span>
                <strong className="font-mono text-slate-800">{mobile}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registered Email:</span>
                <strong className="font-mono text-slate-800">{email}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aadhaar (Masked):</span>
                <strong className="font-mono text-slate-800">{maskAadharNumber(aadharNumber)}</strong>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                  Under Admin Review
                </span>
              </div>
            </div>

            {/* Email Dispatch Notice */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 text-left max-w-sm mx-auto flex items-start gap-2.5">
              <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950">Confirmation Email Sent</p>
                <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                  An official acknowledgement containing your Reference ID <strong>({submittedAppId})</strong> has been dispatched to <strong>{email}</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 text-left max-w-sm mx-auto">
              <p className="font-semibold mb-0.5 text-slate-900">What happens next?</p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                The PG manager will verify your ID documents, allocate your room & bed, and send your official Resident ID and check-in confirmation via Email & SMS.
              </p>
            </div>

            {/* Agreed Rules & Regulations Display Section */}
            <div className="pt-2 text-left max-w-sm mx-auto space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-900">Agreed Rules & Regulations</h3>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✓ Accepted
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                As accepted during KYC onboarding, you are bound by these hostel policies during your stay:
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {rules.map((r, i) => (
                  <div
                    key={r.id || i}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">
                        {i + 1}. {r.title}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                        {r.category}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[10px] leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Print / Save Receipt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900">Verify Your Email</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              We have sent a 6-digit verification code to <br />
              <strong className="text-slate-800">{email}</strong>
            </p>

            {fallbackOtpCode && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-xs flex items-center justify-between shadow-2xs">
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-blue-600 block tracking-wider">
                    Offline / Demo Code
                  </span>
                  <span className="font-mono font-bold tracking-widest text-base text-blue-900">
                    {fallbackOtpCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtpInput(fallbackOtpCode);
                    if (otpError) setOtpError(null);
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
                >
                  Auto-fill
                </button>
              </div>
            )}

            <div className="mb-4">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="• • • • • •"
                value={otpInput}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpInput(cleaned);
                  if (otpError) setOtpError(null);
                }}
                className="w-full text-center tracking-[10px] text-2xl font-bold font-mono py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Check your Gmail Inbox or Spam folder
              </p>
            </div>

            {otpError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 mb-4 flex items-center gap-1.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 mb-4 px-1">
              <span>Didn't get code?</span>
              {otpTimer > 0 ? (
                <span className="font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Resend in {otpTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isSendingOtp}
                  onClick={handleSendOtp}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpInput('');
                  setOtpError(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVerifyingOtp || otpInput.length !== 6}
                onClick={handleVerifyOtp}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Verify Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      {cameraModalTarget && (
        <CameraCaptureModal
          isOpen={Boolean(cameraModalTarget)}
          onClose={() => setCameraModalTarget(null)}
          onCapture={handleCameraCapture}
          title={
            cameraModalTarget === 'photo'
              ? 'Take Profile Photo'
              : cameraModalTarget === 'aadharFront'
              ? 'Capture Aadhaar Card Front'
              : 'Capture Aadhaar Card Back'
          }
        />
      )}

      {/* Image Compression Preview Modal */}
      {compressingFile && (
        <ImageCompressionModal
          isOpen={Boolean(compressingFile)}
          onClose={() => {
            setCompressingFile(null);
            setCompressTarget(null);
          }}
          originalFile={compressingFile}
          onCompressComplete={handleCompressionComplete}
          onCompressed={(file, dataUrl) => handleCompressionComplete(dataUrl, file.size)}
        />
      )}
    </div>
  );
};
