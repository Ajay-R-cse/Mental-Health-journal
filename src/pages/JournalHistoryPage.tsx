import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { JournalEntry, MoodType } from '../types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { MoodSelector } from '../components/MoodSelector';
import { AIJournalInsightsCard } from '../components/AIJournalInsightsCard';
import {
  Search,
  Filter,
  Calendar,
  PenLine,
  Trash2,
  Moon,
  Tag,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Check,
} from 'lucide-react';

const MOOD_EMOJIS: Record<MoodType, string> = {
  'Very Happy': '✨ Radiant',
  Happy: '😊 Good',
  Neutral: '😐 Neutral',
  Sad: '😟 Low',
  'Very Sad': '😫 Down',
};

export const JournalHistoryPage: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const entriesPerPage = 5;

  // View / Edit Modal
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');
  const [editMood, setEditMood] = useState<MoodType>('Happy');
  const [editSleep, setEditSleep] = useState<number>(7.5);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Deletion Modal
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await api.getJournals({
        mood: selectedMood !== 'all' ? selectedMood : undefined,
        sentiment: selectedSentiment !== 'all' ? selectedSentiment : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined,
      });
      setEntries(res.entries);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [selectedMood, selectedSentiment, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEntries();
  };

  const handleOpenEdit = (entry: JournalEntry) => {
    setActiveEntry(entry);
    setEditText(entry.journal_text);
    setEditMood(entry.mood);
    setEditSleep(entry.sleep_hours || 7.5);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!activeEntry) return;
    setIsSavingEdit(true);
    try {
      const res = await api.updateJournal(activeEntry.id, {
        journal_text: editText,
        mood: editMood,
        sleep_hours: editSleep,
      });
      if (res.entry) {
        setEntries(entries.map((e) => (e.id === res.entry.id ? res.entry : e)));
        setActiveEntry(res.entry);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update journal entry:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await api.deleteJournal(entryToDelete.id);
      setEntries(entries.filter((e) => e.id !== entryToDelete.id));
      setEntryToDelete(null);
      if (activeEntry?.id === entryToDelete.id) {
        setActiveEntry(null);
      }
    } catch (err) {
      console.error('Failed to delete journal entry:', err);
    }
  };

  // Paginated records
  const totalPages = Math.ceil(entries.length / entriesPerPage);
  const currentEntries = entries.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Journal History & Past Reflections
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Explore your emotional evolution, past entries, detected sentiment, and keywords.
        </p>
      </div>

      {/* Filter and Search Bar in Dark Theme */}
      <div className="bg-[#13192b] p-4 sm:p-5 rounded-2xl border border-[#242f4e] shadow-lg space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by keywords, emotions, reflections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#1e263d] text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Filters:</span>
          </div>

          {/* Mood Filter */}
          <select
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value)}
            aria-label="Filter by mood"
            className="border border-[#242f4e] rounded-lg px-2.5 py-1.5 bg-[#0e1322] text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
          >
            <option value="all">All Moods</option>
            <option value="Very Happy">✨ Radiant</option>
            <option value="Happy">😊 Good</option>
            <option value="Neutral">😐 Neutral</option>
            <option value="Sad">😟 Low</option>
            <option value="Very Sad">😫 Down</option>
          </select>

          {/* Sentiment Filter */}
          <select
            value={selectedSentiment}
            onChange={(e) => setSelectedSentiment(e.target.value)}
            aria-label="Filter by sentiment"
            className="border border-[#242f4e] rounded-lg px-2.5 py-1.5 bg-[#0e1322] text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
          >
            <option value="all">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
          </select>

          {/* Date range filters */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date filter"
              className="border border-[#242f4e] rounded-lg px-2 py-1 text-xs bg-[#0e1322] text-slate-300"
            />
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date filter"
              className="border border-[#242f4e] rounded-lg px-2 py-1 text-xs bg-[#0e1322] text-slate-300"
            />
          </div>

          {(search || selectedMood !== 'all' || selectedSentiment !== 'all' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedMood('all');
                setSelectedSentiment('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-400 hover:underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Entries List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 mt-3">Loading journal records...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-[#13192b] p-12 rounded-2xl border border-[#242f4e] shadow-lg text-center">
          <Calendar className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Journal Entries Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or capture your first reflection in the Journal tab.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#13192b] p-5 sm:p-6 rounded-2xl border border-[#242f4e] shadow-lg hover:border-[#384775] transition-all space-y-3"
            >
              {/* Top Meta Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">
                    {new Date(entry.entry_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#182035] text-purple-300 border border-[#283556]">
                    {MOOD_EMOJIS[entry.mood] || entry.mood}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                      entry.sentiment === 'Positive'
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                        : entry.sentiment === 'Negative'
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-800/40'
                        : 'bg-[#182035] text-slate-300 border border-[#283556]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{entry.sentiment}</span>
                    <span className="opacity-80 text-[10px] font-mono">
                      ({entry.sentiment_score > 0 ? `+${entry.sentiment_score}` : entry.sentiment_score})
                    </span>
                  </span>
                  {entry.sleep_hours && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#1e223c] text-indigo-300 border border-indigo-800/30 flex items-center gap-1">
                      <Moon className="w-3 h-3" />
                      <span>{entry.sleep_hours}h sleep</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveEntry(entry)}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-[#182035] rounded-lg transition-colors cursor-pointer"
                    title="View Full Entry"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(entry)}
                    className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-[#182035] rounded-lg transition-colors cursor-pointer"
                    title="Edit Entry"
                  >
                    <PenLine className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEntryToDelete(entry)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#182035] rounded-lg transition-colors cursor-pointer"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Journal Body */}
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                {entry.journal_text}
              </p>

              {/* Tags & Timestamp */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1e263d] text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex items-center gap-1 text-cyan-400">
                      <Tag className="w-3 h-3 text-cyan-500" />
                      {entry.tags.map((t, i) => (
                        <span key={i} className="text-[11px] font-medium bg-[#182035] px-2 py-0.5 rounded border border-[#283556]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>Logged {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
              <span>
                Showing {(currentPage - 1) * entriesPerPage + 1} to{' '}
                {Math.min(currentPage * entriesPerPage, entries.length)} of {entries.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 py-1.5 border border-[#242f4e] rounded-lg hover:bg-[#182035] disabled:opacity-40 cursor-pointer flex items-center gap-1 text-slate-300"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="font-semibold text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 py-1.5 border border-[#242f4e] rounded-lg hover:bg-[#182035] disabled:opacity-40 cursor-pointer flex items-center gap-1 text-slate-300"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Reading Modal in Dark Mode */}
      {activeEntry && !isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#13192b] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#242f4e] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e263d] pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {new Date(activeEntry.entry_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#182035] text-purple-300 border border-[#283556] font-medium">
                    {MOOD_EMOJIS[activeEntry.mood] || activeEntry.mood}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-medium">
                    {activeEntry.sentiment} (Score: {activeEntry.sentiment_score})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveEntry(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line py-2">
              {activeEntry.journal_text}
            </div>

            <div className="border-t border-[#1e263d] pt-4 text-xs text-slate-400 space-y-2">
              {activeEntry.tags && activeEntry.tags.length > 0 && (
                <p>
                  <strong className="text-slate-300">Tags:</strong> {activeEntry.tags.map((t) => `#${t}`).join(' ')}
                </p>
              )}
            </div>

            {/* AI Journal Insights for opened entry */}
            <div className="pt-2">
              <AIJournalInsightsCard
                journalText={activeEntry.journal_text}
                manualMood={activeEntry.mood}
                journalSentiment={activeEntry.sentiment}
                journalEntryId={activeEntry.id}
                autoLoadSaved={true}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleOpenEdit(activeEntry)}
                className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Edit Entry</span>
              </button>
              <button
                onClick={() => setActiveEntry(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-[#182035] rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#13192b] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#242f4e] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e263d] pb-3">
              <h3 className="text-base font-bold text-white">Edit Journal Entry</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Update Mood:</label>
              <MoodSelector selectedMood={editMood} onSelectMood={(m) => setEditMood(m)} size="sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Journal Thoughts:</label>
              <textarea
                rows={6}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-3 text-xs border border-[#242f4e] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#0e1322] text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-[#182035] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingEdit ? 'Updating...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!entryToDelete}
        title="Delete Journal Entry"
        message="Are you sure you want to permanently delete this journal entry? This action cannot be undone."
        confirmLabel="Delete Forever"
        onConfirm={handleConfirmDelete}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};
