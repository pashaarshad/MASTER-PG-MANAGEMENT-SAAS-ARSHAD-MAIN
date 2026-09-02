import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, MessageCircle, ExternalLink, X, Link2 } from 'lucide-react';
import { usePG } from '../context/PGContext';
import { getWhatsAppShareUrl } from '../utils/helpers';

interface InviteTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPortalDirectly?: () => void;
}

export const InviteTenantModal: React.FC<InviteTenantModalProps> = ({
  isOpen,
  onClose,
  onOpenPortalDirectly,
}) => {
  const { pgSettings, generateInvitationLink, setPublicPortalMode, setOnboardingToken } = usePG();
  const [copied, setCopied] = useState<boolean>(false);
  const [inviteData, setInviteData] = useState<{ token: string; link: string }>(() => generateInvitationLink());

  useEffect(() => {
    if (isOpen) {
      setInviteData(generateInvitationLink());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const whatsappMessage = `Join Invitation - ${pgSettings.name}:
${inviteData.link}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteData.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenOnboarding = () => {
    setOnboardingToken(inviteData.token);
    if (onOpenPortalDirectly) {
      onOpenPortalDirectly();
    } else {
      setPublicPortalMode(true);
      onClose();
    }
  };

  return (
    <div
      id="invite-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="invite-modal-container"
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200/80 relative space-y-4"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Tenant Join Invitation</h3>
            <p className="text-xs text-slate-500">Invitation Link</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Share this join invitation link with the tenant.
        </p>

        {/* Link Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
          <input
            readOnly
            value={inviteData.link}
            className="bg-transparent text-xs text-slate-800 font-mono flex-1 outline-none truncate selection:bg-blue-500 selection:text-white"
          />
          <button
            id="copy-invite-link-btn"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          <a
            id="invite-whatsapp-btn"
            href={getWhatsAppShareUrl('', whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </a>

          <button
            id="preview-onboarding-btn"
            onClick={handleOpenOnboarding}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};
