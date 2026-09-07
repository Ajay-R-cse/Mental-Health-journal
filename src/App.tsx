import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ActiveTab } from './types';
import { Navbar } from './components/Navbar';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { QuickJournalModal } from './components/QuickJournalModal';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Main Application Pages
import { JournalPage } from './pages/JournalPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { RelaxationPage } from './pages/RelaxationPage';
import { JournalHistoryPage } from './pages/JournalHistoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { MoodTrackingPage } from './pages/MoodTrackingPage';
import { SleepTrackingPage } from './pages/SleepTrackingPage';
import { ActivityTrackingPage } from './pages/ActivityTrackingPage';
import { InsightsPage } from './pages/InsightsPage';
import { CalendarPage } from './pages/CalendarPage';
import { ProfilePage } from './pages/ProfilePage';
import { ShieldCheck, Brain } from 'lucide-react';

const AuthenticatedApp: React.FC = () => {
  // Default to 'journal' tab to immediately display the view in Screenshot 49
  const [activeTab, setActiveTab] = useState<ActiveTab>('journal');
  const [isQuickJournalOpen, setIsQuickJournalOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleQuickSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-900 selection:text-purple-100 transition-colors duration-200">
      {/* 1. Global Well-Being Disclaimer Banner */}
      <DisclaimerBanner />

      {/* 2. Top Header & Navigation (Screenshot 49 & 50) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickJournal={() => setIsQuickJournalOpen(true)}
      />

      {/* 3. Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Primary 4 Views (Screenshot 49, Screenshot 50, Relaxation, History) */}
        {activeTab === 'journal' && (
          <JournalPage
            onNavigate={(tab) => {
              setActiveTab(tab);
              setRefreshKey((prev) => prev + 1);
            }}
            onEntrySaved={() => setRefreshKey((prev) => prev + 1)}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsPage onNavigate={(tab) => setActiveTab(tab as ActiveTab)} />}
        {activeTab === 'relaxation' && <RelaxationPage />}
        {activeTab === 'history' && <JournalHistoryPage />}

        {/* Secondary Detailed Views */}
        {activeTab === 'dashboard' && (
          <DashboardPage
            key={refreshKey}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === 'mood' && <MoodTrackingPage />}
        {activeTab === 'sleep' && <SleepTrackingPage />}
        {activeTab === 'activities' && <ActivityTrackingPage />}
        {activeTab === 'insights' && <InsightsPage />}
        {activeTab === 'calendar' && (
          <CalendarPage onNavigate={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'profile' && <ProfilePage />}
      </main>

      {/* 4. Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-[#1a2238] bg-white dark:bg-[#0b0f19] py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              MindSpace
            </span>
            <span>• Mental Health & Mood Sentiment Analyzer</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Private & Isolated Records
            </span>
            <span>AFINN Real-Time Sentiment Engine</span>
          </div>
        </div>
      </footer>

      {/* Global Quick Journal Entry Modal */}
      <QuickJournalModal
        isOpen={isQuickJournalOpen}
        onClose={() => setIsQuickJournalOpen(false)}
        onSuccess={handleQuickSuccess}
      />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center gap-3 text-slate-200">
        <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-medium">Preparing your MindSpace journal...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
  }

  return <AuthenticatedApp />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
