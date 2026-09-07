import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-[#0e1424] border-b border-[#1e2842] px-4 py-2 text-xs text-slate-300 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span>
            <strong className="text-purple-300">Well-being Notice:</strong> MindSpace is designed for personal journaling and self-reflection.
            Its sentiment analysis and insights are observational and not medical diagnoses.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-[#1a233c] transition-colors cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss disclaimer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
