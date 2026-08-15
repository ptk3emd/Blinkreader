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
  const [view, setView] = useState<'library' | 'dashboard'>('library');

  return (
    <div className="min-h-screen bg-[#18181c] text-[#e8e8ec] font-sans selection:bg-[#FCFD76] selection:text-[#212121]">
      {activeDocumentId ? (
        <Reader 
          documentId={activeDocumentId} 
          onBack={() => setActiveDocumentId(null)} 
        />
      ) : view === 'dashboard' ? (
        <Dashboard onBack={() => setView('library')} />
      ) : (
        <Library 
          onSelect={setActiveDocumentId} 
          onOpenDashboard={() => setView('dashboard')} 
        />
      )}
    </div>
  );
}

