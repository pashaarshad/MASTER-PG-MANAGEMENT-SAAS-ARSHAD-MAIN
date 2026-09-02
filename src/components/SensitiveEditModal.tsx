import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, X, Check } from 'lucide-react';
import { usePG } from '../context/PGContext';

interface SensitiveEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export const SensitiveEditModal: React.FC<SensitiveEditModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  title = 'Admin Security Verification',
  description = 'Please enter the admin edit passcode to modify sensitive records.',
}) => {
  const { verifyAdminPassword } = usePG();
  const [passcode, setPasscode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter passcode');
      return;
    }

    const isValid = verifyAdminPassword(passcode);
    if (isValid) {
      setError(null);
      setPasscode('');
      onVerified();
      onClose();
    } else {
      setError('Incorrect passcode. Default passcode is 6565');
    }
  };

  const handleClose = () => {
    setPasscode('');
    setError(null);
    onClose();
  };

  return (
    <div id="sensitive-edit-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div id="sensitive-edit-modal-container" className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-200/60">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">Authorized Admin Action</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">{description}</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              <span>Enter Security PIN</span>
            </label>
            <div className="relative">
              <input
                id="admin-passcode-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (
                    ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                    (e.ctrlKey || e.metaKey)
                  ) return;
                  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono tracking-widest text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              id="cancel-passcode-btn"
              type="button"
              onClick={handleClose}
              className="py-2 px-4 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              id="verify-passcode-btn"
              type="submit"
              className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
