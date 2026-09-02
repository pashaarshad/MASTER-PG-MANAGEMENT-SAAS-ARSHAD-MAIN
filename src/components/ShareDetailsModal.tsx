import React, { useState } from 'react';
import { Share2, MessageCircle, Mail, Copy, Check, X, ExternalLink } from 'lucide-react';
import { generateWhatsAppAllocationMessage, getWhatsAppShareUrl } from '../utils/helpers';
import { usePG } from '../context/PGContext';
import { Resident } from '../types';

interface ShareDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
}

export const ShareDetailsModal: React.FC<ShareDetailsModalProps> = ({ isOpen, onClose, resident }) => {
  const { pgSettings, buildings, floors } = usePG();
  const [copied, setCopied] = useState<boolean>(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);

  if (!isOpen || !resident) return null;

  const buildingName = buildings.find((b) => b.id === resident.buildingId)?.name || 'Main Building';
  const floorName = floors.find((f) => f.id === resident.floorId)?.name || 'Floor 1';

  const shareText = generateWhatsAppAllocationMessage({
    tenantName: resident.fullName,
    pgName: pgSettings.name,
    building: buildingName,
    floor: floorName,
    room: resident.roomNumber,
    bed: resident.bedNumber,
    sharing: resident.sharingType,
    monthlyRent: resident.monthlyRent,
    securityDeposit: resident.securityDeposit,
    moveInDate: resident.moveInDate,
    residentId: resident.id,
  });

  const whatsappUrl = getWhatsAppShareUrl(resident.mobile, shareText);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmailSimulation = () => {
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div id="share-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div id="share-modal-container" className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200/60">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Share Allocation Details</h3>
            <p className="text-xs text-slate-500">Send confirmation to {resident.fullName}</p>
          </div>
        </div>

        {/* Message preview */}
        <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-xs font-mono text-slate-700 whitespace-pre-line leading-relaxed select-all">
          {shareText}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          {/* WhatsApp */}
          <a
            id="share-whatsapp-btn"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          {/* Email via Resend */}
          <button
            id="send-email-btn"
            type="button"
            onClick={handleSendEmailSimulation}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            {emailSent ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Email Sent!</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Send Email</span>
              </>
            )}
          </button>

          {/* Copy Text */}
          <button
            id="copy-details-btn"
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-2.5 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Details</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
