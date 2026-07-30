import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AttendanceLog, Branch, Employee } from '../types';
import { 
  KeyRound, 
  ShieldAlert, 
  PlusCircle, 
  Edit, 
  Trash2, 
  Save, 
  RefreshCw, 
  Building2, 
  User, 
  Clock, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock
} from 'lucide-react';

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'add' | 'modify'>('add');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Manual Add Form State
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [manualType, setManualType] = useState<'IN' | 'OUT'>('IN');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState<string>('09:00');

  // Modify Logs State
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Authenticate with Super Admin Master Key
  const handleVerifyMasterKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('password', masterPassword.trim())
        .eq('role', 'SUPERADMIN')
        .eq('active', true)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setIsAuthenticated(true);
        fetchBranches();
      } else {
        setAuthError('Invalid Super Admin Master Password.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data } = await supabase.from('branches').select('*').order('name');
      setBranches(data || []);
      if (data && data.length > 0) setSelectedBranch(data[0].name);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedBranch) {
      fetchEmployees(selectedBranch);
    }
  }, [selectedBranch]);

  const fetchEmployees = async (branchName: string) => {
    try {
      const { data } = await supabase.from('employees').select('*').eq('branch_name', branchName).order('name');
      setEmployees(data || []);
      if (data && data.length > 0) setSelectedEmpId(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'modify') {
      fetchLogsForModify();
    }
  }, [isAuthenticated, activeTab, filterDate, filterBranch]);

  const fetchLogsForModify = async () => {
    setLoading(true);
    try {
      let query = supabase.from('attendance_logs').select('*').order('timestamp', { ascending: false });

      if (filterDate) {
        const start = `${filterDate}T00:00:00.000Z`;
        const end = `${filterDate}T23:59:59.999Z`;
        query = query.gte('timestamp', start).lte('timestamp', end);
      }

      if (filterBranch) {
        query = query.eq('branch_name', filterBranch);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Fetch logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setLoading(true);

    try {
      const emp = employees.find((e) => e.id === selectedEmpId);
      if (!emp) throw new Error('Employee not found');

      const timestampISO = new Date(`${manualDate}T${manualTime}:00`).toISOString();

      const { error } = await supabase.from('attendance_logs').insert([
        {
          emp_id: emp.id,
          emp_name: emp.name,
          branch_name: selectedBranch,
          type: manualType,
          timestamp: timestampISO,
          status: 'Super Admin',
          created_by: 'Super Admin',
          photo_source: 'SUPER ADMIN',
        },
      ]);

      if (error) throw error;

      setStatusMessage({ type: 'success', text: `Manual ${manualType} Log Created Successfully for ${emp.name}!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to add manual log.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this attendance log entry?')) return;

    try {
      const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
      if (error) throw error;

      setLogs((prev) => prev.filter((l) => l.id !== id));
      setStatusMessage({ type: 'success', text: 'Log entry deleted successfully.' });
    } catch (err: any) {
      alert('Delete error: ' + err.message);
    }
  };

  const handleUpdateLogType = async (id: string, newType: 'IN' | 'OUT') => {
    try {
      const { error } = await supabase.from('attendance_logs').update({ type: newType }).eq('id', id);
      if (error) throw error;

      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, type: newType } : l)));
    } catch (err: any) {
      alert('Update error: ' + err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-sm space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Super Admin Control Panel</h2>
            <p className="text-xs text-slate-500 mt-1">
              Master Password Verification Required
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
              {authError}
            </div>
          )}

          <form onSubmit={handleVerifyMasterKey} className="space-y-4">
            <input
              type="password"
              required
              placeholder="Enter Master Password (e.g., master123)"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-600 rounded-xl text-sm font-semibold outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              <span>AUTHENTICATE MASTER KEY</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-rose-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-800 text-white flex items-center justify-center border border-rose-700">
            <ShieldAlert className="w-6 h-6 text-rose-300" />
          </div>
          <div>
            <div className="text-[10px] font-extrabold text-rose-300 uppercase tracking-widest">
              High Privileges Mode
            </div>
            <h1 className="text-xl font-extrabold">Super Admin Management</h1>
          </div>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="px-3.5 py-1.5 text-xs font-extrabold text-white bg-rose-800 hover:bg-rose-700 border border-rose-700 rounded-xl transition-all"
        >
          Exit Panel
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border border-slate-200 bg-white rounded-2xl p-1.5">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'add' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>1. Manual Add Record</span>
        </button>
        <button
          onClick={() => setActiveTab('modify')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'modify' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>2. Edit / Delete Records</span>
        </button>
      </div>

      {activeTab === 'add' ? (
        <form onSubmit={handleManualAdd} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Employee
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Punch Type
              </label>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as 'IN' | 'OUT')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold outline-none"
              >
                <option value="IN">SHIFT IN</option>
                <option value="OUT">SHIFT OUT</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Date
              </label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Time
              </label>
              <input
                type="time"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>CREATE MANUAL LOG ENTRY</span>
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Filter Date
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Filter Branch
              </label>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="">🏢 All Branches</option>
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
                Fetching records...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-semibold">
                No logs found to edit or delete for this date.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">{log.emp_name} ({log.emp_id})</div>
                      <div className="text-xs text-slate-500">
                        {log.branch_name} • {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={log.type}
                        onChange={(e) => handleUpdateLogType(log.id, e.target.value as 'IN' | 'OUT')}
                        className="px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50"
                      >
                        <option value="IN">IN</option>
                        <option value="OUT">OUT</option>
                      </select>

                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
