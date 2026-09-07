import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  User as UserIcon,
  Calendar,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Save,
  KeyRound,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState<string>(user?.name || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Password change
  const [currentPass, setCurrentPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMsg(null);
    try {
      await updateProfile(name, email);
      setProfileMsg('Profile details successfully updated!');
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassMsg(null);

    if (newPass.length < 6) {
      setPassError('New password must be at least 6 characters long.');
      return;
    }

    if (newPass !== confirmPass) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPass(true);
    try {
      await changePassword(currentPass, newPass);
      setPassMsg('Password successfully changed!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '2026';

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-300 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Account Profile & Privacy Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal details, credentials, and data privacy preferences.
        </p>
      </div>

      {/* User Card Header */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg flex flex-col sm:flex-row items-center gap-5 transition-colors duration-200">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#06b6d4] text-white flex items-center justify-center font-bold text-2xl shadow-md flex-shrink-0">
          {user?.name ? user.name[0].toUpperCase() : 'U'}
        </div>

        <div className="text-center sm:text-left flex-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{user?.name}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.email}</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Member since {memberSince}
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Private Data Isolation Active
            </span>
          </div>
        </div>
      </div>

      {/* Appearance & Theme Selection Card */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-[#1e263d] pb-3">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appearance & Theme Preference</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Select between Dark Mode for soothing night-time journaling or Light Mode for crisp daylight reading.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dark Mode Choice */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#182035] border-purple-500 ring-2 ring-purple-500/40 text-white'
                : 'bg-slate-50 dark:bg-[#0e1322] border-slate-200 dark:border-[#242f4e] hover:border-slate-400 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-[#0b0f19] text-purple-400 border border-[#232f4e]">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Dark Calm Theme</span>
                {theme === 'dark' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-600/40 font-semibold">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Deep obsidian and navy palette designed for calming reflections and low-light eye comfort.
              </p>
            </div>
          </button>

          {/* Light Mode Choice */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400 text-slate-900 shadow-xs'
                : 'bg-slate-50 dark:bg-[#0e1322] border-slate-200 dark:border-[#242f4e] hover:border-slate-400 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="p-2 rounded-lg bg-white text-amber-500 border border-slate-200 shadow-xs">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Light Clean Theme</span>
                {theme === 'light' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 font-semibold">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bright, crisp daylight palette with high-contrast typography and clean white card containers.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Data Security & Privacy Statement */}
      <div className="bg-purple-50 dark:bg-[#181d33] border border-purple-200 dark:border-[#2b3558] rounded-2xl p-5 flex items-start gap-3.5 text-xs text-purple-900 dark:text-purple-200 transition-colors duration-200">
        <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Strict Personal Data Privacy</h3>
          <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
            Your journal reflections, emotional records, sleep hours, and personal habits are strictly isolated to your individual account ID. Other users cannot search, view, or aggregate your personal records.
          </p>
        </div>
      </div>

      {/* Profile Info Form */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-[#1e263d] pb-3">
          <UserIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Personal Information</h3>
        </div>

        {profileMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
            <span>{profileMsg}</span>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-white dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-white dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-5 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isUpdatingProfile ? 'Saving...' : 'Update Details'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Form */}
      <div className="bg-white dark:bg-[#13192b] p-6 rounded-2xl border border-slate-200 dark:border-[#242f4e] shadow-xs dark:shadow-lg transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-[#1e263d] pb-3">
          <KeyRound className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Security & Password Management</h3>
        </div>

        {passMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
            <span>{passMsg}</span>
          </div>
        )}

        {passError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs font-medium">
            {passError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Current Password</label>
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-white dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">New Password</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-white dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full text-xs border border-slate-200 dark:border-[#242f4e] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-white dark:bg-[#0e1322] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isChangingPass}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-[#232d4b] dark:hover:bg-[#2d3a61] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isChangingPass ? 'Changing Password...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
