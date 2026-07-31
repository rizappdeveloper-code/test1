import React, { useState } from 'react';
import { Branch, Employee } from '../types';
import { downloadSelfiesZip } from '../lib/selfieDownloader';
import { getTodayISTDateString, getCurrentISTMonthString, formatISTDate } from '../lib/dateUtils';
import { 
  X, 
  Download, 
  Calendar, 
  Building2, 
  UserCheck, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileArchive,
  Sparkles
} from 'lucide-react';

interface BatchSelfieModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  employees: Employee[];
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function BatchSelfieModal({
  isOpen,
  onClose,
  branches,
  employees,
  initialStartDate,
  initialEndDate,
}: BatchSelfieModalProps) {
  const today = getTodayISTDateString();
  const [startDate, setStartDate] = useState<string>(initialStartDate || today);
  const [endDate, setEndDate] = useState<string>(initialEndDate || today);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    setProgressPercent(0);
    setProgressText('Initializing download...');

    try {
      const result = await downloadSelfiesZip({
        startDate,
        endDate,
        branchName: selectedBranch || undefined,
        empId: selectedEmpId || undefined,
        onProgress: (current, total, statusText) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          setProgressPercent(pct);
          setProgressText(statusText);
        },
      });

      setSuccessMsg(`Successfully downloaded ${result.count} selfie photos into a ZIP archive!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download selfie photos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Download Selfie Photos</h3>
              <p className="text-xs text-slate-500 font-medium">Download all selfie proofs for any duration in 1 click</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          
          {/* Quick Preset Buttons */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">
              Quick Select Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartDate(today);
                  setEndDate(today);
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-xl border transition-all ${
                  startDate === today && endDate === today
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setStartDate(formatISTDate(d));
                  setEndDate(today);
                }}
                className="py-1.5 px-3 text-xs font-bold rounded-xl border bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate(`${getCurrentISTMonthString()}-01`);
                  setEndDate(today);
                }}
                className="py-1.5 px-3 text-xs font-bold rounded-xl border bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
              >
                This Month
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>End Date</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Building2 className="w-3 h-3 text-indigo-500" />
              <span>Branch (Optional)</span>
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all"
            >
              <option value="">🏢 All Branches</option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <UserCheck className="w-3 h-3 text-indigo-500" />
              <span>Employee (Optional)</span>
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all"
            >
              <option value="">👥 All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.id})
                </option>
              ))}
            </select>
          </div>

          {/* Messages & Progress */}
          {loading && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  {progressText}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={loading}
            className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <FileArchive className="w-4 h-4" />
                <span>Download Selfies ZIP</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
