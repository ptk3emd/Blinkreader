/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Library from './components/Library';
import Reader from './components/Reader';
import Dashboard from './components/Dashboard';

export default function App() {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [initialWordIndex, setInitialWordIndex] = useState<number | undefined>(undefined);
  const [view, setView] = useState<'library' | 'dashboard'>('library');
  const [dashboardTab, setDashboardTab] = useState<'metrics' | 'bookmarks'>('metrics');

  const handleOpenDocument = (docId: string, wordIndex?: number) => {
    setInitialWordIndex(wordIndex);
    setActiveDocumentId(docId);
  };

  const handleOpenDashboard = (tab: 'metrics' | 'bookmarks' = 'metrics') => {
    setDashboardTab(tab);
    setView('dashboard');
  };

  const handleBackToLibrary = () => {
    setActiveDocumentId(null);
    setInitialWordIndex(undefined);
  };

  return (
    <div className="min-h-screen bg-[#18181c] text-[#e8e8ec] font-sans selection:bg-[#FCFD76] selection:text-[#212121]">
      {activeDocumentId ? (
        <Reader 
          documentId={activeDocumentId} 
          initialWordIndex={initialWordIndex}
          onBack={handleBackToLibrary} 
        />
      ) : view === 'dashboard' ? (
        <Dashboard 
          onBack={() => setView('library')} 
          onOpenDocument={handleOpenDocument}
          initialTab={dashboardTab}
        />
      ) : (
        <Library 
          onSelect={(id) => handleOpenDocument(id)} 
          onOpenDashboard={handleOpenDashboard} 
        />
      )}
    </div>
  );
}

