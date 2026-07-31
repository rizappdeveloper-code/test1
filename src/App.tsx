import React, { useState } from 'react';
import IndexPage from './pages/index';
import AdminPage from './pages/admin';
import SuperAdminPage from './pages/superadmin';
import { Camera, ShieldCheck, KeyRound, Building2 } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'punch' | 'admin' | 'superadmin'>('punch');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header & Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              AQ
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
              AQSA <span className="hidden xs:inline">Attendance</span>
            </span>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            <button
              onClick={() => setCurrentView('punch')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 ${
                currentView === 'punch'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Punch</span>
            </button>
            <button
              onClick={() => setCurrentView('admin')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 ${
                currentView === 'admin'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
            <button
              onClick={() => setCurrentView('superadmin')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 ${
                currentView === 'superadmin'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Super</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'punch' && <IndexPage />}
        {currentView === 'admin' && <AdminPage />}
        {currentView === 'superadmin' && <SuperAdminPage />}
      </main>
    </div>
  );
}
