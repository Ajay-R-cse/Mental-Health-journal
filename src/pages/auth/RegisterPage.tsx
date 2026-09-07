import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Brain, User as UserIcon, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { register, loginWithGoogle } = useAuth();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleRegister = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google registration encountered an issue.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client validations
    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password, confirmPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#3b82f6] flex items-center justify-center text-white shadow-lg">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          MindSpace
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400 font-medium">
          Start your journey towards mindful emotional wellness
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#13192b] py-8 px-6 shadow-2xl rounded-3xl border border-[#242f4e] sm:px-10">
          <div className="mb-6">
            <h3 className="text-base font-bold text-white">Create Your Account</h3>
            <p className="text-xs text-slate-400 mt-0.5">All journal records are private and isolated to your profile.</p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/50 text-rose-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full text-xs pl-10 pr-3.5 py-3 border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full text-xs pl-10 pr-3.5 py-3 border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full text-xs pl-10 pr-3.5 py-3 border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full text-xs pl-10 pr-3.5 py-3 border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Social Sign-In Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1e263d]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-[#13192b] text-slate-400">Or register with</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-[#242f4e] rounded-xl text-xs font-semibold text-slate-200 hover:bg-[#182035] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.3 0 10.4 0 12.7s.6 4.4 1.6 6.3l3.7-4.3z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.4-6.7-5.3L1.6 16.4C3.5 20.2 7.4 23.5 12 23.5z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting...' : 'Google Account'}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-purple-400 font-bold hover:underline cursor-pointer"
            >
              Sign In Instead
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>Strict client-isolated privacy & password hashing</span>
        </div>
      </div>
    </div>
  );
};
