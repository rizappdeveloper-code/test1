import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AttendanceLog, Branch, DailySummaryRow, MonthlySummaryRow } from '../types';
import { 
  ShieldCheck, 
  Lock, 
  Calendar, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Camera, 
  RefreshCw, 
  Building2, 
  UserCheck, 
  Clock, 
  AlertCircle,
  LogOut,
  SlidersHorizontal,
  Search
} from 'lucide-react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'live' | 'summary' | 'monthly'>('live');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchEmployee, setSearchEmployee] = useState<string>('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([]);
  const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlySummaryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Admin Verification
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('password', passwordInput.trim())
        .eq('active', true)
        .in('role', ['ADMIN', 'SUPERADMIN'])
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setIsAuthenticated(true);
        setPasswordInput('');
        fetchBranches();
      } else {
        setAuthError('Invalid Admin password or inactive account.');
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
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated, activeTab, selectedDate, selectedMonth, selectedBranch]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'live') {
        let query = supabase
          .from('attendance_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (selectedDate) {
          const start = `${selectedDate}T00:00:00.000Z`;
          const end = `${selectedDate}T23:59:59.999Z`;
          query = query.gte('timestamp', start).lte('timestamp', end);
        }

        if (selectedBranch) {
          query = query.eq('branch_name', selectedBranch);
        }

        const { data, error } = await query;
        if (error) throw error;
        setLiveLogs(data || []);
      } else if (activeTab === 'summary') {
        // Fetch daily logs for the selected date
        let query = supabase
          .from('attendance_logs')
          .select('*')
          .neq('type', 'REJECTED')
          .order('timestamp', { ascending: true });

        if (selectedDate) {
          const start = `${selectedDate}T00:00:00.000Z`;
          const end = `${selectedDate}T23:59:59.999Z`;
          query = query.gte('timestamp', start).lte('timestamp', end);
        }

        const { data: logs } = await query;

        // Group by employee
        const empMap: { [key: string]: AttendanceLog[] } = {};
        (logs || []).forEach((l) => {
          if (!empMap[l.emp_id]) empMap[l.emp_id] = [];
          empMap[l.emp_id].push(l);
        });

        const rows: DailySummaryRow[] = Object.keys(empMap).map((empId) => {
          const empLogs = empMap[empId];
          const firstLog = empLogs[0];
          const inPunches = empLogs.filter((p) => p.type === 'IN');
          const outPunches = empLogs.filter((p) => p.type === 'OUT');

          let totalMs = 0;
          for (let i = 0; i < Math.min(inPunches.length, outPunches.length); i++) {
            const inTime = new Date(inPunches[i].timestamp).getTime();
            const outTime = new Date(outPunches[i].timestamp).getTime();
            if (outTime > inTime) totalMs += outTime - inTime;
          }

          const hours = Number((totalMs / (1000 * 60 * 60)).toFixed(2));
          const ot = Number(Math.max(0, hours - 11).toFixed(2));
          const isMissingOut = inPunches.length > outPunches.length;

          return {
            date: selectedDate,
            empId: firstLog.emp_id,
            name: firstLog.emp_name,
            branch: firstLog.branch_name,
            in1: inPunches[0] ? new Date(inPunches[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            out1: outPunches[0] ? new Date(outPunches[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            in2: inPunches[1] ? new Date(inPunches[1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            out2: outPunches[1] ? new Date(outPunches[1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            in3: inPunches[2] ? new Date(inPunches[2].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            out3: outPunches[2] ? new Date(outPunches[2].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            in4: '', out4: '', in5: '', out5: '',
            in1Photo: inPunches[0]?.photo_url || '',
            out1Photo: outPunches[0]?.photo_url || '',
            totalHours: hours.toFixed(2),
            ot: ot.toFixed(2),
            status: isMissingOut ? 'Missing OUT' : 'Present',
          };
        });

        setSummaryRows(rows);
      } else {
        // Monthly Summary
        const { data: monthLogs } = await supabase
          .from('attendance_logs')
          .select('*')
          .neq('type', 'REJECTED');

        const monthlyMap: { [key: string]: { name: string; branch: string; days: Set<string>; hours: number } } = {};

        (monthLogs || []).forEach((l) => {
          const logDate = l.timestamp.substring(0, 7);
          if (selectedMonth && logDate !== selectedMonth) return;

          if (!monthlyMap[l.emp_id]) {
            monthlyMap[l.emp_id] = { name: l.emp_name, branch: l.branch_name, days: new Set(), hours: 0 };
          }
          const dayStr = l.timestamp.substring(0, 10);
          monthlyMap[l.emp_id].days.add(dayStr);
        });

        const rows: MonthlySummaryRow[] = Object.keys(monthlyMap).map((empId) => {
          const data = monthlyMap[empId];
          const presentDays = data.days.size;
          return {
            month: selectedMonth,
            empId,
            name: data.name,
            branch: data.branch,
            presentDays,
            absentDays: Math.max(0, 26 - presentDays),
            totalHours: (presentDays * 8).toFixed(2),
            otHours: '0.00',
            missingDays: 0,
          };
        });

        setMonthlyRows(rows);
      }
    } catch (err: any) {
      console.error('Fetch Admin Data Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    let csv = '';
    if (activeTab === 'live') {
      csv = 'Date,Time,Employee ID,Name,Branch,Type,Distance(m),Photo URL\n';
      liveLogs.forEach((row) => {
        csv += `${row.timestamp.substring(0, 10)},${new Date(row.timestamp).toLocaleTimeString()},${row.emp_id},"${row.emp_name}","${row.branch_name}",${row.type},${row.distance_m || 0},"${row.photo_url || ''}"\n`;
      });
    } else if (activeTab === 'summary') {
      csv = 'Date,EmpID,Name,Branch,IN1,OUT1,TotalHours,OT,Status\n';
      summaryRows.forEach((row) => {
        csv += `${row.date},${row.empId},"${row.name}","${row.branch}",${row.in1},${row.out1},${row.totalHours},${row.ot},${row.status}\n`;
      });
    } else {
      csv = 'Month,EmpID,Name,Branch,PresentDays,AbsentDays,TotalHours,OTHours,MissingDays\n';
      monthlyRows.forEach((row) => {
        csv += `${row.month},${row.empId},"${row.name}","${row.branch}",${row.presentDays},${row.absentDays},${row.totalHours},${row.otHours},${row.missingDays}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AQSA_Attendance_${activeTab}_${selectedDate}.csv`;
    a.click();
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Admin Area Access</h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter password to unlock administrator dashboard.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
              {authError}
            </div>
          )}

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <input
              type="password"
              required
              placeholder="Enter Admin Password (e.g., admin123)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl text-sm font-semibold outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>VERIFY ACCESS</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Admin Report Dashboard</h1>
            <p className="text-xs text-slate-500 font-semibold">
              Live Attendance Records & Analytical Summaries
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAuthenticated(false)}
          className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <LogOut className="w-3.5 h-3.5" />
          Lock Session
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 border">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
            activeTab === 'live' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Live Punch Logs
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
            activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Daily Summary Report
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
            activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Monthly Overview
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Filter Date
          </label>
          <input
            type={activeTab === 'monthly' ? 'month' : 'date'}
            value={activeTab === 'monthly' ? selectedMonth : selectedDate}
            onChange={(e) =>
              activeTab === 'monthly' ? setSelectedMonth(e.target.value) : setSelectedDate(e.target.value)
            }
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Filter Branch
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
          >
            <option value="">🏢 All Branches</option>
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={fetchDashboardData}
            className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Content Tables */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
            Loading attendance records from database...
          </div>
        ) : activeTab === 'live' ? (
          liveLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No live attendance logs found for this date.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="p-3.5">Time</th>
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Distance</th>
                    <th className="p-3.5 text-center">Selfie Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {liveLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-mono text-slate-900 font-bold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900">{log.emp_name}</div>
                        <div className="text-[10px] text-slate-400">ID: {log.emp_id}</div>
                      </td>
                      <td className="p-3.5">{log.branch_name}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            log.type === 'IN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.type === 'OUT'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          SHIFT-{log.type}
                        </span>
                      </td>
                      <td className="p-3.5">{log.distance_m || 0}m</td>
                      <td className="p-3.5 text-center">
                        {log.photo_url ? (
                          <a href={log.photo_url} target="_blank" rel="noreferrer" className="inline-block">
                            <img
                              src={log.photo_url}
                              alt="Selfie"
                              className="w-9 h-9 object-cover rounded-lg border border-slate-300 shadow-xs hover:scale-110 transition-transform"
                            />
                          </a>
                        ) : (
                          <span className="text-slate-300 italic">No Photo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'summary' ? (
          summaryRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No daily summary rows calculated.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">IN / OUT 1</th>
                    <th className="p-3.5">Total Hrs</th>
                    <th className="p-3.5">OT</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {summaryRows.map((r) => (
                    <tr key={r.empId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900">{r.name}</div>
                        <div className="text-[10px] text-slate-400">ID: {r.empId}</div>
                      </td>
                      <td className="p-3.5">{r.branch}</td>
                      <td className="p-3.5 font-mono">
                        {r.in1 || '-'} / {r.out1 || '-'}
                      </td>
                      <td className="p-3.5 font-bold text-indigo-700">{r.totalHours}h</td>
                      <td className="p-3.5 font-bold text-amber-700">{r.ot}h</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            r.status === 'Present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">Branch</th>
                  <th className="p-3.5">Present Days</th>
                  <th className="p-3.5">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {monthlyRows.map((m) => (
                  <tr key={m.empId} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-extrabold text-slate-900">{m.name}</td>
                    <td className="p-3.5">{m.branch}</td>
                    <td className="p-3.5 font-bold text-emerald-700">{m.presentDays} days</td>
                    <td className="p-3.5 font-bold text-indigo-700">{m.totalHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
