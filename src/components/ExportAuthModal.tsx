import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, Loader2, X } from 'lucide-react';

export interface ExportAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password?: string) => void | Promise<void>;
  isLoading?: boolean;
  authProvider: 'google' | 'password';
}

export const ExportAuthModal: React.FC<ExportAuthModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  authProvider,
}) => {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset internal states whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authProvider === 'password' && !password.trim()) {
      setError('Please enter your account password to verify your identity.');
      return;
    }

    setError(null);
    try {
      await onConfirm(authProvider === 'password' ? password : undefined);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    }
  };

  return (
    <div
      id="export-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        id="export-auth-modal"
        className="w-full max-w-md bg-white dark:bg-[#13192b] rounded-3xl border border-slate-200 dark:border-[#242f4e] shadow-2xl p-6 sm:p-7 relative overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a233c] transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Security Badge */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/60 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2
              id="export-modal-title"
              className="text-lg font-bold font-serif text-slate-900 dark:text-white leading-snug"
            >
              {authProvider === 'google' ? 'Verify Identity with Google' : 'Confirm Password to Export'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {authProvider === 'google'
                ? 'Your journal entries and mood records are private health data. Re-authenticate with Google to download your complete data archive.'
                : 'Your journal entries and mood records are private health data. Re-enter your password to download your complete data archive.'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            id="export-auth-error"
            className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authProvider === 'google' ? (
            <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <p className="font-medium">
                You logged in using Google. Please re-authenticate with Google to verify your identity.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="export-password-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Account Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="export-password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isLoading}
                    placeholder="Enter your current password"
                    autoFocus
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-50 dark:bg-[#182035] border border-slate-200 dark:border-[#242f4e] focus:border-teal-600 dark:focus:border-teal-400 focus:outline-hidden text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-colors disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#182035]/60 border border-slate-100 dark:border-[#1f2842] text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Note: For demo accounts, the default password is <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[10px]">Wellness2026!</code>.
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              id="cancel-export-button"
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a233c] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-export-button"
              type="submit"
              disabled={isLoading || (authProvider === 'password' && !password.trim())}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>{authProvider === 'google' ? 'Verify with Google' : 'Verify & Export'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
