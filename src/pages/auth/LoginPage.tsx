import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Brain, Mail, Lock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onSwitchToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const { login, loginAsDemo, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [demoLoading, setDemoLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMessage(null);
    setDemoLoading(true);
    try {
      await loginAsDemo();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in with demo account.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in encountered an issue.');
    } finally {
      setGoogleLoading(false);
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
          Mental Health & Mood Sentiment Analyzer
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#13192b] py-8 px-6 shadow-2xl rounded-3xl border border-[#242f4e] sm:px-10">
          <div className="mb-6">
            <h3 className="text-base font-bold text-white">Welcome Back</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sign in to access your private journals & reflections.</p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/50 text-rose-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Quick Demo Login Banner */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="w-full mb-5 py-2.5 px-4 bg-[#1a1c36] hover:bg-[#25224d] border border-purple-800/40 text-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>{demoLoading ? 'Accessing Demo Workspace...' : 'Explore with Demo Account (Alex Morgan)'}</span>
          </button>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.demo@wellness.com"
                  className="w-full text-xs pl-10 pr-3.5 py-3 border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-10 pr-3.5 py-3 border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
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
                <span className="px-2 bg-[#13192b] text-slate-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
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
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-purple-400 font-bold hover:underline cursor-pointer"
            >
              Create an Account
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>Strict client-isolated privacy & password hashing</span>
        </div>
      </div>

      <ForgotPasswordModal isOpen={showForgot} onClose={() => setShowForgot(false)} />
    </div>
  );
};
