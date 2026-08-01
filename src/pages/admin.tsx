import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AttendanceLog, Branch, DailySummaryRow, MonthlySummaryRow, Employee } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateFormattedPDF, generateSelfiePDF, generateLiveSelfiePDF } from '../lib/pdfReport';
import BatchSelfieModal from '../components/BatchSelfieModal';
import SuperAdminCrud from '../components/SuperAdminCrud';
import {
  getTodayISTDateString,
  getCurrentISTMonthString,
  formatISTTime,
  formatISTDate,
  formatISTDateTime,
  getISTDateRangeISO,
} from '../lib/dateUtils';
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
  Search,
  QrCode,
  X,
  Printer,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Folder,
  ExternalLink,
  FileArchive,
  Database
} from 'lucide-react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // User Role & Super Admin Section Security
  const [userRole, setUserRole] = useState<'ADMIN' | 'SUPERADMIN' | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Admin');
  const [showSuperAdminUnlockModal, setShowSuperAdminUnlockModal] = useState<boolean>(false);
  const [superAdminPassInput, setSuperAdminPassInput] = useState<string>('');
  const [superAdminAuthError, setSuperAdminAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'live' | 'summary' | 'monthly' | 'crud'>('live');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISTDateString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentISTMonthString());
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([]);
  const [summaryRows, setSummaryRows] = useState<DailySummaryRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlySummaryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Detail Modal State
  const [selectedDetailRow, setSelectedDetailRow] = useState<DailySummaryRow | null>(null);
  const [detailLogs, setDetailLogs] = useState<AttendanceLog[]>([]);

  // QR Generator Modal State
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Batch Selfie Download Modal State
  const [showBatchSelfieModal, setShowBatchSelfieModal] = useState<boolean>(false);

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
        setUserRole((data[0].role as 'ADMIN' | 'SUPERADMIN') || 'ADMIN');
        setUserEmail(data[0].email_or_username || 'Admin');
        setPasswordInput('');
        fetchBranchesAndEmployees();
      } else {
        setAuthError('Invalid Admin password or inactive account.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  // Unlock Super Admin Mode with Super Admin Password
  const handleVerifySuperAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuperAdminAuthError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('password', superAdminPassInput.trim())
        .eq('active', true)
        .eq('role', 'SUPERADMIN')
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setUserRole('SUPERADMIN');
        setShowSuperAdminUnlockModal(false);
        setSuperAdminPassInput('');
        setActiveTab('crud');
      } else {
        setSuperAdminAuthError('Invalid Super Admin password or insufficient privileges.');
      }
    } catch (err: any) {
      setSuperAdminAuthError(err.message || 'Super Admin authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const seedGasSampleLogsIfEmpty = async () => {
    try {
      const { count } = await supabase.from('attendance_logs').select('*', { count: 'exact', head: true });
      if (count && count > 0) return;

      const sampleLogs: AttendanceLog[] = [
        {
          id: '1785404103031',
          emp_id: 'PNK-059',
          emp_name: 'ANISH',
          branch_name: 'PNK',
          type: 'OUT',
          timestamp: '2026-07-30T15:05:03.000Z',
          lat: 9.3671116,
          lng: 78.9488866,
          distance_m: 8,
          photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          photo_source: 'LIVE (Camera)',
          file_name: '17854040839998951393207389109030.jpg',
          verification_delay: 12.5,
          accuracy: 31.95,
          status: 'Selfie'
        },
        {
          id: '1785403375100',
          emp_id: 'PNK-056',
          emp_name: 'IJAS',
          branch_name: 'PNK',
          type: 'OUT',
          timestamp: '2026-07-30T14:52:55.000Z',
          lat: 9.3671371,
          lng: 78.9489367,
          distance_m: 5,
          photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
          photo_source: 'LIVE (Camera)',
          file_name: '17854032394961766603049032433536.jpg',
          verification_delay: 48.2,
          accuracy: 19.83,
          status: 'Selfie'
        },
        {
          id: '1785402869961',
          emp_id: 'PNK-041',
          emp_name: 'GEETHA',
          branch_name: 'PNK',
          type: 'IN',
          timestamp: '2026-07-30T14:44:30.000Z',
          lat: 9.3671101,
          lng: 78.9488916,
          distance_m: 8,
          photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
          photo_source: 'LIVE (Camera)',
          file_name: '17854028498341951888399491480632.jpg',
          verification_delay: 14.5,
          accuracy: 45.60,
          status: 'Selfie'
        },
        {
          id: '1785402818305',
          emp_id: 'PNK-036',
          emp_name: 'BANUMATHI',
          branch_name: 'PNK',
          type: 'IN',
          timestamp: '2026-07-30T14:43:38.000Z',
          lat: 9.3670901,
          lng: 78.9488736,
          distance_m: 10,
          photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
          photo_source: 'LIVE (Camera)',
          file_name: '17854028051048304986024847137104.jpg',
          verification_delay: 7.8,
          accuracy: 17.63,
          status: 'Selfie'
        }
      ];

      await supabase.from('attendance_logs').upsert(sampleLogs, { onConflict: 'id' });
    } catch (e) {
      console.error('Seed logs error:', e);
    }
  };

  const fetchBranchesAndEmployees = async () => {
    try {
      const { data: bData } = await supabase.from('branches').select('*').order('name');
      setBranches(bData || []);

      const { data: eData } = await supabase.from('employees').select('*').eq('active', true).order('name');
      setAllEmployees(eData || []);
    } catch (err) {
      console.error('Error fetching branches/employees:', err);
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
      await seedGasSampleLogsIfEmpty();

      if (activeTab === 'live') {
        let query = supabase
          .from('attendance_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (selectedDate) {
          const { startISO, endISO } = getISTDateRangeISO(selectedDate);
          query = query.gte('timestamp', startISO).lte('timestamp', endISO);
        }

        if (selectedBranch) {
          query = query.eq('branch_name', selectedBranch);
        }

        const { data, error } = await query;
        if (error) throw error;
        setLiveLogs(data || []);
      } else if (activeTab === 'summary') {
        let query = supabase
          .from('attendance_logs')
          .select('*')
          .neq('type', 'REJECTED')
          .order('timestamp', { ascending: true });

        if (selectedDate) {
          const { startISO, endISO } = getISTDateRangeISO(selectedDate);
          query = query.gte('timestamp', startISO).lte('timestamp', endISO);
        }

        const { data: logs } = await query;

        // Group by employee
        const empMap: { [key: string]: AttendanceLog[] } = {};
        (logs || []).forEach((l) => {
          if (!empMap[l.emp_id]) empMap[l.emp_id] = [];
          empMap[l.emp_id].push(l);
        });

        // Also include active employees who have no punches (Absent)
        const relevantEmployees = selectedBranch 
          ? allEmployees.filter(e => e.branch_name === selectedBranch)
          : allEmployees;

        const rows: DailySummaryRow[] = relevantEmployees.map((emp) => {
          const empLogs = empMap[emp.id] || [];
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

          let status = 'Absent';
          if (empLogs.length > 0) {
            status = inPunches.length > outPunches.length ? 'Missing OUT' : 'Present';
          }

          return {
            date: selectedDate,
            empId: emp.id,
            name: emp.name,
            branch: emp.branch_name,
            in1: inPunches[0] ? formatISTTime(inPunches[0].timestamp) : '',
            out1: outPunches[0] ? formatISTTime(outPunches[0].timestamp) : '',
            in2: inPunches[1] ? formatISTTime(inPunches[1].timestamp) : '',
            out2: outPunches[1] ? formatISTTime(outPunches[1].timestamp) : '',
            in3: inPunches[2] ? formatISTTime(inPunches[2].timestamp) : '',
            out3: outPunches[2] ? formatISTTime(outPunches[2].timestamp) : '',
            in4: inPunches[3] ? formatISTTime(inPunches[3].timestamp) : '',
            out4: outPunches[3] ? formatISTTime(outPunches[3].timestamp) : '',
            in5: inPunches[4] ? formatISTTime(inPunches[4].timestamp) : '',
            out5: outPunches[4] ? formatISTTime(outPunches[4].timestamp) : '',
            in1Photo: inPunches[0]?.photo_url || '',
            out1Photo: outPunches[0]?.photo_url || '',
            in2Photo: inPunches[1]?.photo_url || '',
            out2Photo: outPunches[1]?.photo_url || '',
            in3Photo: inPunches[2]?.photo_url || '',
            out3Photo: outPunches[2]?.photo_url || '',
            in4Photo: inPunches[3]?.photo_url || '',
            out4Photo: outPunches[3]?.photo_url || '',
            in5Photo: inPunches[4]?.photo_url || '',
            out5Photo: outPunches[4]?.photo_url || '',
            totalHours: hours.toFixed(2),
            ot: ot.toFixed(2),
            status,
          };
        });

        setSummaryRows(rows);
      } else {
        // Monthly Summary
        const { data: monthLogs } = await supabase
          .from('attendance_logs')
          .select('*')
          .neq('type', 'REJECTED');

        const monthlyMap: { [key: string]: { name: string; branch: string; days: Set<string>; hours: number; missing: number } } = {};

        (monthLogs || []).forEach((l) => {
          const logDate = formatISTDate(l.timestamp).substring(0, 7);
          if (selectedMonth && logDate !== selectedMonth) return;

          if (!monthlyMap[l.emp_id]) {
            monthlyMap[l.emp_id] = { name: l.emp_name, branch: l.branch_name, days: new Set(), hours: 0, missing: 0 };
          }
          const dayStr = formatISTDate(l.timestamp);
          monthlyMap[l.emp_id].days.add(dayStr);
        });

        const relevantEmployees = selectedBranch 
          ? allEmployees.filter(e => e.branch_name === selectedBranch)
          : allEmployees;

        const rows: MonthlySummaryRow[] = relevantEmployees.map((emp) => {
          const data = monthlyMap[emp.id] || { name: emp.name, branch: emp.branch_name, days: new Set(), hours: 0, missing: 0 };
          const presentDays = data.days.size;
          return {
            month: selectedMonth,
            empId: emp.id,
            name: emp.name,
            branch: emp.branch_name,
            presentDays,
            absentDays: Math.max(0, 26 - presentDays),
            totalHours: (presentDays * 8).toFixed(2),
            otHours: '0.00',
            missingDays: data.missing,
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

  // Filtered dataset calculations
  const filteredLiveLogs = liveLogs.filter((log) => {
    const matchEmp = !selectedEmpFilter || log.emp_id === selectedEmpFilter;
    const matchStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'CURRENT_IN' && log.type === 'IN') ||
      (selectedStatus === 'CURRENT_OUT' && log.type === 'OUT');
    return matchEmp && matchStatus;
  });

  const filteredSummaryRows = summaryRows.filter((row) => {
    const matchEmp = !selectedEmpFilter || row.empId === selectedEmpFilter;
    const matchStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'CURRENT_IN' && row.in1 !== '' && row.out1 === '') ||
      (selectedStatus === 'CURRENT_OUT' && row.out1 !== '') ||
      (selectedStatus === 'ABSENT' && row.status === 'Absent') ||
      (selectedStatus === 'MISSING_OUT' && row.status === 'Missing OUT');
    return matchEmp && matchStatus;
  });

  const filteredMonthlyRows = monthlyRows.filter((row) => {
    const matchEmp = !selectedEmpFilter || row.empId === selectedEmpFilter;
    const matchStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ABSENT' && row.presentDays === 0) ||
      (selectedStatus === 'MISSING_OUT' && row.missingDays > 0);
    return matchEmp && matchStatus;
  });

  // Calculate stats counters
  const totalEmployeesCount = allEmployees.length;
  const activeInCount = summaryRows.filter((r) => r.in1 !== '' && r.out1 === '').length;
  const finishedOutCount = summaryRows.filter((r) => r.out1 !== '').length;

  // Open Log Details Modal
  const handleOpenDetailModal = async (row: DailySummaryRow) => {
    setSelectedDetailRow(row);
    try {
      const { startISO, endISO } = getISTDateRangeISO(selectedDate);

      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('emp_id', row.empId)
        .gte('timestamp', startISO)
        .lte('timestamp', endISO)
        .order('timestamp', { ascending: true });

      setDetailLogs(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // CSV Export
  const handleDownloadCSV = () => {
    let csv = '';
    if (activeTab === 'live') {
      csv = 'Date,Time,Employee ID,Name,Branch,Type,Distance(m),Photo URL\n';
      filteredLiveLogs.forEach((row) => {
        csv += `${formatISTDate(row.timestamp)},${formatISTTime(row.timestamp, true)},${row.emp_id},"${row.emp_name}","${row.branch_name}",${row.type},${row.distance_m || 0},"${row.photo_url || ''}"\n`;
      });
    } else if (activeTab === 'summary') {
      csv = 'Date,EmpID,Name,Branch,IN1,OUT1,IN2,OUT2,IN3,OUT3,TotalHours,OT,Status\n';
      filteredSummaryRows.forEach((row) => {
        csv += `${row.date},${row.empId},"${row.name}","${row.branch}",${row.in1},${row.out1},${row.in2},${row.out2},${row.in3},${row.out3},${row.totalHours},${row.ot},${row.status}\n`;
      });
    } else {
      csv = 'Month,EmpID,Name,Branch,PresentDays,AbsentDays,TotalHours,OTHours,MissingDays\n';
      filteredMonthlyRows.forEach((row) => {
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

  // Standard PDF Export
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`AQSA ATTENDANCE REPORT (${activeTab.toUpperCase()})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Date: ${selectedDate} | Generated: ${formatISTDateTime(new Date())}`, 14, 22);

    if (activeTab === 'live') {
      const tableData = filteredLiveLogs.map((l) => [
        formatISTTime(l.timestamp, true),
        l.emp_id,
        l.emp_name,
        l.branch_name,
        `SHIFT-${l.type}`,
        `${l.distance_m || 0}m`,
      ]);
      autoTable(doc, {
        startY: 28,
        head: [['Time (IST)', 'Emp ID', 'Name', 'Branch', 'Type', 'Distance']],
        body: tableData,
      });
    } else if (activeTab === 'summary') {
      const tableData = filteredSummaryRows.map((s) => [
        s.empId,
        s.name,
        s.branch,
        `${s.in1 || '-'} / ${s.out1 || '-'}`,
        `${s.totalHours}h`,
        `${s.ot}h`,
        s.status,
      ]);
      autoTable(doc, {
        startY: 28,
        head: [['Emp ID', 'Name', 'Branch', 'IN1 / OUT1', 'Total Hours', 'OT', 'Status']],
        body: tableData,
      });
    } else {
      const tableData = filteredMonthlyRows.map((m) => [
        m.empId,
        m.name,
        m.branch,
        `${m.presentDays} days`,
        `${m.absentDays} days`,
        `${m.totalHours}h`,
      ]);
      autoTable(doc, {
        startY: 28,
        head: [['Emp ID', 'Name', 'Branch', 'Present', 'Absent', 'Total Hours']],
        body: tableData,
      });
    }

    doc.save(`AQSA_Attendance_${activeTab}_${selectedDate}.pdf`);
  };

  // Helper to fetch summary data on demand for PDF reports regardless of current tab
  const getSummaryDataForPDF = async () => {
    if (summaryRows.length > 0 && activeTab === 'summary') {
      return filteredSummaryRows;
    }
    const { startISO, endISO } = getISTDateRangeISO(selectedDate);

    let query = supabase
      .from('attendance_logs')
      .select('*')
      .neq('type', 'REJECTED')
      .gte('timestamp', startISO)
      .lte('timestamp', endISO)
      .order('timestamp', { ascending: true });

    if (selectedBranch) {
      query = query.eq('branch_name', selectedBranch);
    }

    const { data: logs } = await query;
    const empMap: { [key: string]: AttendanceLog[] } = {};
    (logs || []).forEach((l) => {
      if (!empMap[l.emp_id]) empMap[l.emp_id] = [];
      empMap[l.emp_id].push(l);
    });

    const relevantEmployees = selectedBranch
      ? allEmployees.filter((e) => e.branch_name === selectedBranch)
      : allEmployees;

    return relevantEmployees
      .filter((emp) => !selectedEmpFilter || emp.id === selectedEmpFilter)
      .map((emp) => {
        const empLogs = empMap[emp.id] || [];
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

        let status = 'Absent';
        if (empLogs.length > 0) {
          status = inPunches.length > outPunches.length ? 'Missing OUT' : 'Present';
        }

        return {
          date: selectedDate,
          empId: emp.id,
          name: emp.name,
          branch: emp.branch_name,
          in1: inPunches[0] ? formatISTTime(inPunches[0].timestamp) : '',
          out1: outPunches[0] ? formatISTTime(outPunches[0].timestamp) : '',
          in2: inPunches[1] ? formatISTTime(inPunches[1].timestamp) : '',
          out2: outPunches[1] ? formatISTTime(outPunches[1].timestamp) : '',
          in3: inPunches[2] ? formatISTTime(inPunches[2].timestamp) : '',
          out3: outPunches[2] ? formatISTTime(outPunches[2].timestamp) : '',
          in4: inPunches[3] ? formatISTTime(inPunches[3].timestamp) : '',
          out4: outPunches[3] ? formatISTTime(outPunches[3].timestamp) : '',
          in5: inPunches[4] ? formatISTTime(inPunches[4].timestamp) : '',
          out5: outPunches[4] ? formatISTTime(outPunches[4].timestamp) : '',
          in1Photo: inPunches[0]?.photo_url || '',
          out1Photo: outPunches[0]?.photo_url || '',
          in2Photo: inPunches[1]?.photo_url || '',
          out2Photo: outPunches[1]?.photo_url || '',
          in3Photo: inPunches[2]?.photo_url || '',
          out3Photo: outPunches[2]?.photo_url || '',
          in4Photo: inPunches[3]?.photo_url || '',
          out4Photo: outPunches[3]?.photo_url || '',
          in5Photo: inPunches[4]?.photo_url || '',
          out5Photo: outPunches[4]?.photo_url || '',
          totalHours: hours.toFixed(2),
          ot: ot.toFixed(2),
          status,
        };
      });
  };

  // Helper to fetch live logs on demand for Live Selfie PDF
  const getLiveLogsForPDF = async () => {
    if (liveLogs.length > 0 && activeTab === 'live') {
      return filteredLiveLogs;
    }
    const { startISO, endISO } = getISTDateRangeISO(selectedDate);

    let query = supabase
      .from('attendance_logs')
      .select('*')
      .gte('timestamp', startISO)
      .lte('timestamp', endISO)
      .order('timestamp', { ascending: false });

    if (selectedBranch) {
      query = query.eq('branch_name', selectedBranch);
    }
    if (selectedEmpFilter) {
      query = query.eq('emp_id', selectedEmpFilter);
    }

    const { data } = await query;
    return data || [];
  };

  // GAS Matching Formatted PDF Report
  const handleDownloadFormattedPDF = async () => {
    setLoading(true);
    try {
      const data = await getSummaryDataForPDF();
      if (!data || data.length === 0) {
        alert('No attendance data available for the selected date.');
        return;
      }
      await generateFormattedPDF(data, selectedDate);
    } catch (err: any) {
      console.error('PDF Error:', err);
      alert('Error generating Formatted PDF: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // GAS Matching PDF with Selfie Proofs (Daily Summary Report)
  const handleDownloadSelfiePDF = async () => {
    setLoading(true);
    try {
      const data = await getSummaryDataForPDF();
      if (!data || data.length === 0) {
        alert('No attendance data available for the selected date.');
        return;
      }
      await generateSelfiePDF(data, selectedDate);
    } catch (err: any) {
      console.error('Selfie PDF Error:', err);
      alert('Error generating Selfie PDF: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // GAS Matching Live Selfie PDF
  const handleDownloadLiveSelfiePDF = async () => {
    setLoading(true);
    try {
      const logs = await getLiveLogsForPDF();
      if (!logs || logs.length === 0) {
        alert('No live attendance logs found for the selected date.');
        return;
      }
      await generateLiveSelfiePDF(logs, selectedDate);
    } catch (err: any) {
      console.error('Live Selfie PDF Error:', err);
      alert('Error generating Live Selfie PDF: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Print View for Selfie Reports
  const handlePrintSelfieReport = () => {
    window.print();
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
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 print:max-w-none print:p-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">Admin Report Dashboard</h1>
              {userRole === 'SUPERADMIN' ? (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
                  SUPERADMIN MODE
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">
              Live Attendance Records & Analytical Summaries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          <button
            onClick={() => setShowQrModal(true)}
            className="flex-1 sm:flex-none justify-center px-3 py-2 text-xs font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Generate QR</span>
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setUserRole(null);
            }}
            className="flex-1 sm:flex-none justify-center px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Session</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:flex border border-slate-200 bg-white rounded-2xl p-1.5 gap-1 print:hidden">
        <button
          onClick={() => setActiveTab('live')}
          className={`py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all sm:flex-1 text-center ${
            activeTab === 'live' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Live Punch Logs
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all sm:flex-1 text-center ${
            activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Daily Summary
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all sm:flex-1 text-center ${
            activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Monthly Overview
        </button>
        <button
          onClick={() => {
            if (userRole === 'SUPERADMIN') {
              setActiveTab('crud');
            } else {
              setShowSuperAdminUnlockModal(true);
            }
          }}
          className={`py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 sm:flex-1 text-center ${
            activeTab === 'crud' ? 'bg-slate-900 text-amber-400 shadow-sm ring-1 ring-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Super Admin</span>
          {userRole !== 'SUPERADMIN' && <Lock className="w-3 h-3 text-slate-400 ml-0.5 shrink-0" />}
        </button>
      </div>

      {activeTab === 'crud' ? (
        <SuperAdminCrud branches={branches} />
      ) : (
        <>
          {/* Stats Counter Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 print:hidden">
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
              <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total Staff</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1">{totalEmployeesCount}</div>
            </div>
            <div className="bg-emerald-50 p-3 sm:p-4 rounded-2xl border border-emerald-200 shadow-xs text-center">
              <div className="text-[9px] sm:text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Active SHIFT-IN</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5 sm:mt-1">{activeInCount}</div>
            </div>
            <div className="bg-rose-50 p-3 sm:p-4 rounded-2xl border border-rose-200 shadow-xs text-center">
              <div className="text-[9px] sm:text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">Completed OUT</div>
              <div className="text-xl sm:text-2xl font-black text-rose-800 mt-0.5 sm:mt-1">{finishedOutCount}</div>
            </div>
          </div>

      {/* Filters & Export Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Filter Date / Month
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

        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Filter Employee
          </label>
          <select
            value={selectedEmpFilter}
            onChange={(e) => setSelectedEmpFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
          >
            <option value="">👥 All Employees</option>
            {allEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Status Filter
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold outline-none"
          >
            <option value="ALL">🔍 Show All Statuses</option>
            <option value="CURRENT_IN">✅ Currently Still IN</option>
            <option value="CURRENT_OUT">🚩 Finished (OUT)</option>
            <option value="ABSENT">❌ Absent Status</option>
            <option value="MISSING_OUT">⚠️ Missing OUT</option>
          </select>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={fetchDashboardData}
          className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>

        <button
          onClick={handleDownloadCSV}
          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>CSV Export</span>
        </button>

        <button
          onClick={handleDownloadFormattedPDF}
          className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Formatted PDF</span>
        </button>

        <button
          onClick={handleDownloadSelfiePDF}
          className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Selfie Proofs PDF</span>
        </button>

        <button
          onClick={handleDownloadLiveSelfiePDF}
          className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Live Selfie PDF</span>
        </button>

        <button
          onClick={() => setShowBatchSelfieModal(true)}
          className="col-span-2 sm:col-span-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <FileArchive className="w-3.5 h-3.5" />
          <span>Download Selfies ZIP</span>
        </button>
      </div>

      {/* Main Table & Mobile Card Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-semibold animate-pulse">
            Fetching attendance records from database...
          </div>
        ) : activeTab === 'live' ? (
          filteredLiveLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No live attendance logs found for this filter selection.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5">Branch</th>
                      <th className="p-3.5">Punch Type</th>
                      <th className="p-3.5">Distance</th>
                      <th className="p-3.5 text-center">Selfie Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredLiveLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-mono text-slate-900 font-bold">
                          {formatISTTime(log.timestamp, true)}
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
                                className="w-16 h-16 object-cover rounded-2xl border-2 border-slate-300 shadow-xs hover:scale-105 transition-transform"
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

              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-slate-100">
                {filteredLiveLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          log.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.type === 'OUT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        SHIFT-{log.type}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {formatISTTime(log.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-slate-900 text-sm">{log.emp_name}</div>
                        <div className="text-xs text-slate-500 font-semibold">
                          ID: {log.emp_id} • {log.branch_name}
                        </div>
                      </div>
                      <div className="text-right text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {log.distance_m || 0}m GPS
                      </div>
                    </div>

                    {log.photo_url ? (
                      <a href={log.photo_url} target="_blank" rel="noreferrer" className="block relative">
                        <img
                          src={log.photo_url}
                          alt="Selfie Proof"
                          className="w-full h-44 object-cover rounded-xl border border-slate-300"
                        />
                        <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                          Tap to view full
                        </span>
                      </a>
                    ) : (
                      <div className="w-full h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs italic">
                        No Selfie Captured
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )
        ) : activeTab === 'summary' ? (
          filteredSummaryRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              No daily summary rows calculated for this date.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5">Branch</th>
                      <th className="p-3.5">Shift Punches (Sets 1–5)</th>
                      <th className="p-3.5">Selfie Proofs (Sets 1–5)</th>
                      <th className="p-3.5">Total Hrs</th>
                      <th className="p-3.5">OT</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredSummaryRows.map((r) => {
                      const activeSets = [
                        { num: 1, inTime: r.in1, outTime: r.out1, inPhoto: r.in1Photo, outPhoto: r.out1Photo },
                        { num: 2, inTime: r.in2, outTime: r.out2, inPhoto: r.in2Photo, outPhoto: r.out2Photo },
                        { num: 3, inTime: r.in3, outTime: r.out3, inPhoto: r.in3Photo, outPhoto: r.out3Photo },
                        { num: 4, inTime: r.in4, outTime: r.out4, inPhoto: r.in4Photo, outPhoto: r.out4Photo },
                        { num: 5, inTime: r.in5, outTime: r.out5, inPhoto: r.in5Photo, outPhoto: r.out5Photo },
                      ].filter((s) => s.inTime || s.outTime || s.inPhoto || s.outPhoto);

                      return (
                        <tr key={r.empId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5">
                            <div className="font-extrabold text-slate-900">{r.name}</div>
                            <div className="text-[10px] text-slate-400">ID: {r.empId}</div>
                          </td>
                          <td className="p-3.5">{r.branch}</td>
                          <td className="p-3.5 font-mono">
                            {activeSets.length === 0 ? (
                              <span className="text-slate-400 font-sans italic text-[11px]">- / -</span>
                            ) : (
                              <div className="space-y-1.5">
                                {activeSets.map((s) => (
                                  <div key={s.num} className="flex items-center gap-1.5 text-[11px]">
                                    <span className="text-[9px] font-extrabold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                      Set {s.num}
                                    </span>
                                    <span className="text-emerald-700 font-bold">{s.inTime || '--:--'}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-rose-700 font-bold">{s.outTime || '--:--'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            {activeSets.length === 0 ? (
                              <span className="text-slate-300 italic text-[10px]">None</span>
                            ) : (
                              <div className="space-y-2">
                                {activeSets.map((s) => (
                                  <div key={s.num} className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-slate-400 w-9">Set {s.num}:</span>
                                    <div className="flex items-center gap-2.5">
                                      {s.inPhoto ? (
                                        <a href={s.inPhoto} target="_blank" rel="noreferrer" className="group relative block">
                                          <img
                                            src={s.inPhoto}
                                            alt={`Set ${s.num} IN`}
                                            className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-cover border-2 border-emerald-400 shadow-xs group-hover:scale-105 transition-transform"
                                            title={`Set ${s.num} IN Selfie (${s.inTime || 'N/A'})`}
                                          />
                                          <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-xs">
                                            IN
                                          </span>
                                        </a>
                                      ) : s.inTime ? (
                                        <span className="text-[9px] text-slate-400 italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                          No IN Photo
                                        </span>
                                      ) : null}

                                      {s.outPhoto ? (
                                        <a href={s.outPhoto} target="_blank" rel="noreferrer" className="group relative block">
                                          <img
                                            src={s.outPhoto}
                                            alt={`Set ${s.num} OUT`}
                                            className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-cover border-2 border-rose-400 shadow-xs group-hover:scale-105 transition-transform"
                                            title={`Set ${s.num} OUT Selfie (${s.outTime || 'N/A'})`}
                                          />
                                          <span className="absolute -bottom-1 -right-1 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-xs">
                                            OUT
                                          </span>
                                        </a>
                                      ) : s.outTime ? (
                                        <span className="text-[9px] text-slate-400 italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                          No OUT Photo
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-indigo-700">{r.totalHours}h</td>
                          <td className="p-3.5 font-bold text-amber-700">{r.ot}h</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                r.status === 'Present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'Missing OUT'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleOpenDetailModal(r)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Proofs</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for Daily Summary */}
              <div className="block md:hidden divide-y divide-slate-100">
                {filteredSummaryRows.map((r) => {
                  const activeSets = [
                    { num: 1, inTime: r.in1, outTime: r.out1, inPhoto: r.in1Photo, outPhoto: r.out1Photo },
                    { num: 2, inTime: r.in2, outTime: r.out2, inPhoto: r.in2Photo, outPhoto: r.out2Photo },
                    { num: 3, inTime: r.in3, outTime: r.out3, inPhoto: r.in3Photo, outPhoto: r.out3Photo },
                    { num: 4, inTime: r.in4, outTime: r.out4, inPhoto: r.in4Photo, outPhoto: r.out4Photo },
                    { num: 5, inTime: r.in5, outTime: r.out5, inPhoto: r.in5Photo, outPhoto: r.out5Photo },
                  ].filter((s) => s.inTime || s.outTime || s.inPhoto || s.outPhoto);

                  return (
                    <div key={r.empId} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm">{r.name}</div>
                          <div className="text-xs text-slate-500 font-semibold">
                            ID: {r.empId} • {r.branch}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            r.status === 'Present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'Missing OUT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center font-bold">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Total Hours</span>
                          <span className="text-indigo-700">{r.totalHours}h</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Overtime (OT)</span>
                          <span className="text-amber-700">{r.ot}h</span>
                        </div>
                      </div>

                      {/* Sets list */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-600">Shift Punch Sets:</div>
                        {activeSets.length === 0 ? (
                          <div className="text-xs text-slate-400 italic">No punches today</div>
                        ) : (
                          activeSets.map((s) => (
                            <div key={s.num} className="p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-black text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                                  Set {s.num}
                                </span>
                                <div className="font-mono text-xs">
                                  <span className="text-emerald-700 font-bold">{s.inTime || '--:--'}</span>
                                  <span className="text-slate-300 mx-1">/</span>
                                  <span className="text-rose-700 font-bold">{s.outTime || '--:--'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                {s.inPhoto ? (
                                  <a href={s.inPhoto} target="_blank" rel="noreferrer" className="relative block group">
                                    <img
                                      src={s.inPhoto}
                                      alt="Set IN"
                                      className="w-full h-40 sm:h-48 rounded-xl object-cover border-2 border-emerald-400 shadow-xs group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-emerald-950/80 text-white text-[9px] font-black px-2 py-1 rounded-lg backdrop-blur-xs flex items-center justify-between">
                                      <span>IN</span>
                                      <span className="font-mono">{s.inTime || '--:--'}</span>
                                    </div>
                                  </a>
                                ) : s.inTime ? (
                                  <div className="w-full h-24 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 italic">
                                    No IN Selfie
                                  </div>
                                ) : null}

                                {s.outPhoto ? (
                                  <a href={s.outPhoto} target="_blank" rel="noreferrer" className="relative block group">
                                    <img
                                      src={s.outPhoto}
                                      alt="Set OUT"
                                      className="w-full h-40 sm:h-48 rounded-xl object-cover border-2 border-rose-400 shadow-xs group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-rose-950/80 text-white text-[9px] font-black px-2 py-1 rounded-lg backdrop-blur-xs flex items-center justify-between">
                                      <span>OUT</span>
                                      <span className="font-mono">{s.outTime || '--:--'}</span>
                                    </div>
                                  </a>
                                ) : s.outTime ? (
                                  <div className="w-full h-24 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 italic">
                                    No OUT Selfie
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenDetailModal(r)}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View All Proofs & Timestamps</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : (
          <>
            {/* Desktop Table View for Monthly */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Branch</th>
                    <th className="p-3.5">Present Days</th>
                    <th className="p-3.5">Absent Days</th>
                    <th className="p-3.5">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredMonthlyRows.map((m) => (
                    <tr key={m.empId} className="hover:bg-slate-50/70">
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-400">ID: {m.empId}</div>
                      </td>
                      <td className="p-3.5">{m.branch}</td>
                      <td className="p-3.5 font-bold text-emerald-700">{m.presentDays} days</td>
                      <td className="p-3.5 font-bold text-rose-700">{m.absentDays} days</td>
                      <td className="p-3.5 font-bold text-indigo-700">{m.totalHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Monthly */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredMonthlyRows.map((m) => (
                <div key={m.empId} className="p-4 space-y-2 bg-white">
                  <div className="font-black text-slate-900 text-sm">{m.name}</div>
                  <div className="text-xs text-slate-500 font-semibold">
                    ID: {m.empId} • {m.branch}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-bold text-xs">
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <span className="text-[9px] text-emerald-600 block uppercase">Present</span>
                      <span className="text-emerald-800">{m.presentDays}d</span>
                    </div>
                    <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <span className="text-[9px] text-rose-600 block uppercase">Absent</span>
                      <span className="text-rose-800">{m.absentDays}d</span>
                    </div>
                    <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                      <span className="text-[9px] text-indigo-600 block uppercase">Total Hrs</span>
                      <span className="text-indigo-800">{m.totalHours}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )}

      {/* Detail Modal Overlay for Shift Proofs */}
      {selectedDetailRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{selectedDetailRow.name}</h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Employee ID: {selectedDetailRow.empId} • {selectedDetailRow.branch}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailRow(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              <div className="text-xs font-bold text-slate-700">Daily Punch Proofs & Timestamps:</div>
              {detailLogs.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No individual punch logs recorded for today.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            log.type === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          SHIFT-{log.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold">
                          {formatISTTime(log.timestamp, true)}
                        </span>
                      </div>

                      {log.photo_url ? (
                        <a href={log.photo_url} target="_blank" rel="noreferrer" className="block relative group">
                          <img
                            src={log.photo_url}
                            alt="Selfie Proof"
                            className="w-full h-64 sm:h-72 object-cover rounded-xl border border-slate-300 hover:opacity-90 transition-opacity"
                          />
                          <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                            Full Size ↗
                          </span>
                        </a>
                      ) : (
                        <div className="w-full h-64 sm:h-72 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs italic">
                          No Photo Captured
                        </div>
                      )}

                      <div className="text-[9px] text-slate-500 font-medium">
                        <div>Dist: {log.distance_m || 0}m</div>
                        <div>Source: {log.photo_source || 'Unknown'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedDetailRow(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Generator Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Employee QR Code Generator</h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Scannable Employee Badges for Fast Kiosk Check-In
                </p>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2">
              {allEmployees.map((emp) => {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}?id=${emp.id}`
                )}`;

                return (
                  <div key={emp.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 text-center space-y-2">
                    <img src={qrUrl} alt={`QR for ${emp.name}`} className="w-28 h-28 mx-auto rounded-lg border border-slate-300" />
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{emp.name}</div>
                      <div className="text-[10px] text-slate-500">ID: {emp.id}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Badges</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Selfie Download Modal */}
      <BatchSelfieModal
        isOpen={showBatchSelfieModal}
        onClose={() => setShowBatchSelfieModal(false)}
        branches={branches}
        employees={allEmployees}
        initialStartDate={selectedDate}
        initialEndDate={selectedDate}
      />

      {/* Super Admin Unlock Password Modal */}
      {showSuperAdminUnlockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Super Admin Verification Required</h3>
                  <p className="text-[10px] text-amber-300 font-semibold">Enter Super Admin Password to access database controls</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowSuperAdminUnlockModal(false);
                  setSuperAdminAuthError(null);
                  setSuperAdminPassInput('');
                }}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySuperAdminPassword} className="p-6 space-y-4 text-xs">
              {superAdminAuthError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{superAdminAuthError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 block">Super Admin Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter Super Admin password..."
                  value={superAdminPassInput}
                  onChange={(e) => setSuperAdminPassInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuperAdminUnlockModal(false);
                    setSuperAdminAuthError(null);
                    setSuperAdminPassInput('');
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-extrabold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Unlock Super Admin Section</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
