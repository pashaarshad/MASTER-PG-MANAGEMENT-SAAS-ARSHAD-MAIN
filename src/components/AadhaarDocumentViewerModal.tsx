import React, { useState, useRef } from 'react';
import {
  FileText,
  X,
  CheckCircle2,
  Download,
  ZoomIn,
  Upload,
  Camera,
  RotateCw,
  Eye,
  ShieldCheck,
  User,
  QrCode,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { Resident, ResidentApplication } from '../types';

interface AadhaarDocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentData: {
    id: string;
    fullName: string;
    aadharNumberMasked: string;
    aadharUrl?: string;
    photoUrl?: string;
    permanentAddress?: string;
    gender?: string;
    mobile?: string;
    dob?: string;
    occupation?: string;
  } | null;
  onUpdateAadhaarUrl?: (newUrl: string) => void;
}

export const AadhaarDocumentViewerModal: React.FC<AadhaarDocumentViewerModalProps> = ({
  isOpen,
  onClose,
  documentData,
  onUpdateAadhaarUrl,
}) => {
  const { updateResident } = usePG();
  const [activeTab, setActiveTab] = useState<'DOCUMENT' | 'DIGITAL_CARD' | 'PHOTO'>('DOCUMENT');
  const [rotationDegree, setRotationDegree] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string>('');
  const [currentAadharUrl, setCurrentAadharUrl] = useState<string>(documentData?.aadharUrl || '');
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when documentData changes
  React.useEffect(() => {
    if (documentData) {
      setCurrentAadharUrl(documentData.aadharUrl || '');
      setRotationDegree(0);
      setIsZoomed(false);
      setImageLoadError(false);
      // If no aadharUrl or it's empty, default to DIGITAL_CARD or DOCUMENT
      if (!documentData.aadharUrl) {
        setActiveTab('DIGITAL_CARD');
      } else {
        setActiveTab('DOCUMENT');
      }
    }
  }, [documentData]);

  if (!isOpen || !documentData) return null;

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotationDegree((prev) => (prev + 90) % 360);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCurrentAadharUrl(dataUrl);
      setImageLoadError(false);
      setActiveTab('DOCUMENT');

      // Update resident in context if applicable
      if (documentData.id.startsWith('RES-')) {
        updateResident(documentData.id, { aadharUrl: dataUrl });
      }

      if (onUpdateAadhaarUrl) {
        onUpdateAadhaarUrl(dataUrl);
      }

      setUploadSuccessMsg('Aadhaar document updated successfully!');
      setTimeout(() => setUploadSuccessMsg(''), 3000);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('Failed to read selected image file.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownload = () => {
    const urlToDownload =
      activeTab === 'PHOTO'
        ? documentData.photoUrl || currentAadharUrl
        : currentAadharUrl;

    if (!urlToDownload) {
      alert('No custom document image available to download.');
      return;
    }

    const a = document.createElement('a');
    a.href = urlToDownload;
    a.download = `Aadhaar_${documentData.fullName.replace(/\s+/g, '_')}_${documentData.aadharNumberMasked.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const displayAadharNumber = documentData.aadharNumberMasked || 'XXXX-XXXX-0000';
  const formattedNumber = displayAadharNumber.replace(/-/g, ' ');

  return (
    <>
      <div
        id="aadhaar-viewer-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          id="aadhaar-viewer-modal-card"
          className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {documentData.fullName}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>KYC Verified</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Masked Aadhaar: <strong className="text-slate-800">{documentData.aadharNumberMasked}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('DOCUMENT')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'DOCUMENT'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Aadhaar Document</span>
            </button>

            <button
              onClick={() => setActiveTab('DIGITAL_CARD')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'DIGITAL_CARD'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>UIDAI Digital Card</span>
            </button>

            <button
              onClick={() => setActiveTab('PHOTO')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'PHOTO'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tenant Photo</span>
            </button>
          </div>

          {/* Success Banner */}
          {uploadSuccessMsg && (
            <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{uploadSuccessMsg}</span>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* TAB 1: Real Uploaded Document Image */}
            {activeTab === 'DOCUMENT' && (
              <div className="space-y-3">
                <div className="relative group w-full min-h-[220px] max-h-[360px] bg-slate-900/5 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center p-2">
                  {currentAadharUrl && !imageLoadError ? (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                      <img
                        src={currentAadharUrl}
                        alt="Aadhaar Document"
                        style={{ transform: `rotate(${rotationDegree}deg)` }}
                        className="max-h-[340px] w-auto max-w-full object-contain rounded-xl transition-transform duration-200 cursor-pointer shadow-sm"
                        onClick={() => setIsZoomed(true)}
                        onError={() => setImageLoadError(true)}
                      />
                      {/* Floating image controls */}
                      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl text-white shadow-lg">
                        <button
                          type="button"
                          onClick={handleRotate}
                          title="Rotate 90°"
                          className="p-1.5 hover:bg-white/20 rounded-lg transition"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsZoomed(true)}
                          title="Fullscreen Zoom"
                          className="p-1.5 hover:bg-white/20 rounded-lg transition"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Fallback when no direct image is uploaded yet */
                    <div className="py-8 px-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto mb-3">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1">
                        No Scanned Image Uploaded Yet
                      </h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                        You can view the UIDAI Digital Card tab or upload the resident's physical Aadhaar card photo below.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Aadhaar Photo</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Upload & Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{currentAadharUrl ? 'Replace Photo' : 'Upload Image'}</span>
                    </button>

                    {currentAadharUrl && (
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Supports JPG, PNG, WebP (Auto-compressed)
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Authentic UIDAI Digital Card Display */}
            {activeTab === 'DIGITAL_CARD' && (
              <div className="space-y-4">
                {/* Aadhaar Card Front Mockup */}
                <div className="border-2 border-slate-300/80 rounded-2xl overflow-hidden shadow-md bg-white">
                  {/* Saffron & Green Official UIDAI Header */}
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-2.5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-serif text-[11px] font-bold">
                        🏛️
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-wider leading-none">
                          भारत सरकार • GOVERNMENT OF INDIA
                        </p>
                        <p className="text-[9px] text-amber-100 leading-tight">
                          Unique Identification Authority of India
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded">
                      UIDAI
                    </div>
                  </div>

                  {/* Body with photo & details */}
                  <div className="p-4 bg-gradient-to-b from-white to-slate-50 flex items-start gap-4">
                    {/* Photo box */}
                    <div className="w-24 h-28 shrink-0 rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-100 flex items-center justify-center shadow-inner">
                      {documentData.photoUrl ? (
                        <img
                          src={documentData.photoUrl}
                          alt={documentData.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-10 h-10 text-slate-400" />
                      )}
                    </div>

                    {/* Resident Aadhaar Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Name</span>
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {documentData.fullName}
                        </h4>
                      </div>

                      {documentData.gender && (
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Gender</span>
                          <p className="text-xs font-semibold text-slate-700">{documentData.gender}</p>
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Permanent Address</span>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {documentData.permanentAddress || 'Address on record with PG Management'}
                        </p>
                      </div>
                    </div>

                    {/* QR Code / Security Hologram */}
                    <div className="shrink-0 text-center">
                      <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center shadow-xs">
                        <QrCode className="w-14 h-14 text-slate-800" />
                      </div>
                      <span className="text-[8px] font-semibold text-emerald-700 mt-1 block">
                        Verified UIDAI
                      </span>
                    </div>
                  </div>

                  {/* Red/Amber bottom bar with 12-digit number */}
                  <div className="bg-slate-900 text-white py-2.5 px-4 flex items-center justify-between border-t border-slate-800">
                    <span className="text-[10px] font-medium text-slate-400">AADHAAR NUMBER:</span>
                    <span className="font-mono text-base font-bold tracking-widest text-amber-400">
                      {formattedNumber}
                    </span>
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-900 mb-0.5">Government ID Verification</p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Tenant identity and address records are validated under masked Aadhaar compliance standards.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Tenant KYC Photo */}
            {activeTab === 'PHOTO' && (
              <div className="space-y-3">
                <div className="w-full aspect-square max-h-[320px] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto shadow-inner">
                  {documentData.photoUrl ? (
                    <img
                      src={documentData.photoUrl}
                      alt={documentData.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-400">
                      <User className="w-16 h-16 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No profile photo uploaded</p>
                    </div>
                  )}
                </div>

                {documentData.photoUrl && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Tenant Photo</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Modal Footer */}
          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl transition flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document Scan</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Zoom Modal */}
      {isZoomed && currentAadharUrl && (
        <div
          id="aadhaar-fullscreen-lightbox"
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={currentAadharUrl}
            alt="Fullscreen Aadhaar"
            style={{ transform: `rotate(${rotationDegree}deg)` }}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl transition-transform"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
