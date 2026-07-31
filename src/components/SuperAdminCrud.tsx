import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Database,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Search,
  Check,
  X,
  AlertTriangle,
  Download,
  Copy,
  Eye,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Building2,
  Clock,
  ShieldCheck,
  Settings
} from 'lucide-react';

interface SuperAdminCrudProps {
  branches?: any[];
}

const PRESET_TABLES = [
  { id: 'employees', label: 'Employees', icon: Users, desc: 'Staff directory & active status' },
  { id: 'branches', label: 'Branches', icon: Building2, desc: 'Branch locations & geofences' },
  { id: 'attendance_logs', label: 'Attendance Logs', icon: Clock, desc: 'Raw punch records & selfie proofs' },
  { id: 'admin_users', label: 'Admin Users', icon: ShieldCheck, desc: 'Admin login credentials & roles' },
];

export default function SuperAdminCrud({ branches = [] }: SuperAdminCrudProps) {
  const [selectedTable, setSelectedTable] = useState<string>('employees');
  const [customTableName, setCustomTableName] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  const [records, setRecords] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selected rows for bulk action
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form State for Create/Update
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [rawJsonInput, setRawJsonInput] = useState<string>('');
  const [useRawJsonMode, setUseRawJsonMode] = useState<boolean>(false);

  const activeTableName = isCustomMode ? customTableName.trim() : selectedTable;

  // Fetch records whenever active table, page, or pageSize changes
  useEffect(() => {
    if (activeTableName) {
      fetchTableData();
    }
  }, [activeTableName, page, pageSize]);

  // Clear notification banners after 4 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const fetchTableData = async () => {
    if (!activeTableName) return;
    setLoading(true);
    setErrorMsg(null);
    setSelectedIds(new Set());

    try {
      // 1. Fetch count
      const { count, error: countErr } = await supabase
        .from(activeTableName)
        .select('*', { count: 'exact', head: true });

      if (countErr) throw countErr;
      setTotalCount(count || 0);

      // 2. Fetch page rows
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from(activeTableName)
        .select('*')
        .range(from, to)
        .order('created_at' in (records[0] || {}) ? 'created_at' : 'id', { ascending: false });

      if (error) {
        // Fallback without ordering if created_at doesn't exist
        const { data: fallbackData, error: fbErr } = await supabase
          .from(activeTableName)
          .select('*')
          .range(from, to);
        if (fbErr) throw fbErr;
        setRecords(fallbackData || []);
        extractColumns(fallbackData || []);
      } else {
        setRecords(data || []);
        extractColumns(data || []);
      }
    } catch (err: any) {
      console.error('Fetch table error:', err);
      setErrorMsg(`Failed to load "${activeTableName}": ${err.message || 'Table might not exist or lacks RLS permission.'}`);
      setRecords([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const extractColumns = (data: any[]) => {
    if (data.length === 0) {
      // Use standard schemas for preset tables if empty
      if (selectedTable === 'employees') setColumns(['id', 'name', 'branch_name', 'active', 'photo_url', 'created_at']);
      else if (selectedTable === 'branches') setColumns(['id', 'name', 'lat', 'lng', 'radius', 'created_at']);
      else if (selectedTable === 'attendance_logs') setColumns(['id', 'emp_id', 'emp_name', 'branch_name', 'type', 'timestamp', 'lat', 'lng', 'distance_m', 'photo_url', 'photo_source', 'file_name', 'created_at']);
      else if (selectedTable === 'admin_users') setColumns(['id', 'email_or_username', 'password', 'role', 'active', 'created_at']);
      else setColumns(['id']);
      return;
    }

    // Collect all keys across fetched rows
    const keysSet = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((k) => keysSet.add(k));
    });

    // Ensure 'id' is first if exists
    const cols = Array.from(keysSet);
    if (cols.includes('id')) {
      const filtered = cols.filter((c) => c !== 'id');
      setColumns(['id', ...filtered]);
    } else {
      setColumns(cols);
    }
  };

  // Filter records by search query
  const filteredRecords = records.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(rec).some((val) => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(q);
    });
  });

  // Handle Select All Rows
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set<string>(filteredRecords.map((r) => String(r.id)));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    const initial: Record<string, any> = {};
    columns.forEach((col) => {
      if (col === 'id' && (selectedTable === 'attendance_logs' || selectedTable === 'branches')) {
        initial[col] = String(Date.now());
      } else if (col === 'active') {
        initial[col] = true;
      } else if (col === 'role') {
        initial[col] = 'ADMIN';
      } else if (col === 'type') {
        initial[col] = 'IN';
      } else if (col === 'radius') {
        initial[col] = 100;
      } else if (col === 'timestamp' || col === 'created_at') {
        initial[col] = new Date().toISOString();
      } else {
        initial[col] = '';
      }
    });
    setFormData(initial);
    setRawJsonInput(JSON.stringify(initial, null, 2));
    setUseRawJsonMode(false);
    setIsAddModalOpen(true);
  };

  // Create Record
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      let dataToInsert = {};
      if (useRawJsonMode) {
        dataToInsert = JSON.parse(rawJsonInput);
      } else {
        // Clean empty string fields or format numbers/booleans
        dataToInsert = { ...formData };
        Object.keys(dataToInsert).forEach((k) => {
          if (dataToInsert[k] === '') {
            // Remove optional empty string or set null if not required
            delete dataToInsert[k];
          } else if (['lat', 'lng', 'radius', 'distance_m', 'accuracy', 'verification_delay'].includes(k)) {
            dataToInsert[k] = parseFloat(dataToInsert[k]);
          } else if (['active'].includes(k)) {
            dataToInsert[k] = Boolean(dataToInsert[k]);
          }
        });
      }

      const { data, error } = await supabase.from(activeTableName).insert([dataToInsert]).select();

      if (error) throw error;

      setSuccessMsg(`Successfully created record in "${activeTableName}"!`);
      setIsAddModalOpen(false);
      fetchTableData();
    } catch (err: any) {
      console.error('Insert error:', err);
      setErrorMsg(`Create failed: ${err.message || 'Invalid data payload.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: any) => {
    setEditingRecord(rec);
    setFormData({ ...rec });
    setRawJsonInput(JSON.stringify(rec, null, 2));
    setUseRawJsonMode(false);
  };

  // Update Record
  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      let dataToUpdate = {};
      if (useRawJsonMode) {
        dataToUpdate = JSON.parse(rawJsonInput);
      } else {
        dataToUpdate = { ...formData };
        Object.keys(dataToUpdate).forEach((k) => {
          if (['lat', 'lng', 'radius', 'distance_m', 'accuracy', 'verification_delay'].includes(k)) {
            if (dataToUpdate[k] !== '' && dataToUpdate[k] !== null) {
              dataToUpdate[k] = parseFloat(dataToUpdate[k]);
            }
          }
        });
      }

      // Assume primary key is 'id'
      const recordId = editingRecord.id;
      if (!recordId) {
        throw new Error("Cannot update record because it missing an 'id' primary key.");
      }

      const { error } = await supabase
        .from(activeTableName)
        .update(dataToUpdate)
        .eq('id', recordId);

      if (error) throw error;

      setSuccessMsg(`Record #${recordId} updated successfully!`);
      setEditingRecord(null);
      fetchTableData();
    } catch (err: any) {
      console.error('Update error:', err);
      setErrorMsg(`Update failed: ${err.message || 'Check field types or permissions.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete Single Record
  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const recordId = deletingRecord.id;
      if (!recordId) throw new Error("Record missing 'id' key.");

      const { error } = await supabase
        .from(activeTableName)
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      setSuccessMsg(`Record #${recordId} deleted from ${activeTableName}.`);
      setDeletingRecord(null);
      fetchTableData();
    } catch (err: any) {
      console.error('Delete error:', err);
      setErrorMsg(`Delete failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from(activeTableName)
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      setSuccessMsg(`Successfully deleted ${idsArray.length} records from ${activeTableName}.`);
      setIsBulkDeleteOpen(false);
      setSelectedIds(new Set());
      fetchTableData();
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      setErrorMsg(`Bulk delete failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export Table Data to JSON file
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTableName}_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Table Data to CSV
  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = columns.join(',');
    const rows = records.map((r) =>
      columns
        .map((col) => {
          let val = r[col];
          if (val === null || val === undefined) val = '';
          else if (typeof val === 'object') val = JSON.stringify(val);
          // Escape quotes
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTableName}_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format cell display value cleanly
  const renderCellContent = (val: any, colName: string) => {
    if (val === null || val === undefined) {
      return <span className="text-slate-300 italic font-normal text-[11px]">null</span>;
    }

    if (typeof val === 'boolean') {
      return val ? (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">TRUE</span>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">FALSE</span>
      );
    }

    const strVal = String(val);

    // Image fields (photo_url or base64)
    if (colName.includes('photo') || colName.includes('image') || strVal.startsWith('data:image/') || strVal.startsWith('http')) {
      if (strVal.startsWith('data:image/') || strVal.match(/\.(jpeg|jpg|gif|png|webp)/i) || colName.includes('photo')) {
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewImage(strVal)}
              className="group relative focus:outline-none"
              title="Click to view full image"
            >
              <img
                src={strVal}
                alt="Cell"
                className="w-9 h-9 rounded-lg object-cover border border-slate-300 shadow-2xs group-hover:scale-110 transition-transform"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </button>
            <span className="text-[10px] text-slate-400 max-w-[100px] truncate">{strVal.substring(0, 20)}...</span>
          </div>
        );
      }
    }

    // Long text truncation
    if (strVal.length > 50) {
      return (
        <span className="font-mono text-[11px] text-slate-700" title={strVal}>
          {strVal.substring(0, 48)}...
        </span>
      );
    }

    return <span className="font-mono text-[11px] text-slate-800">{strVal}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Table Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Super Admin Database Manager</h2>
              <p className="text-xs text-slate-500 font-semibold">
                Direct CRUD control (Create, Read, Update, Delete) on Supabase tables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCsv}
              disabled={records.length === 0}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportJson}
              disabled={records.length === 0}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Export JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              onClick={fetchTableData}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Preset Tables Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PRESET_TABLES.map((t) => {
            const Icon = t.icon;
            const isSelected = !isCustomMode && selectedTable === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setIsCustomMode(false);
                  setSelectedTable(t.id);
                  setPage(1);
                }}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                  {isSelected && <span className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-white/20 rounded">Active</span>}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-black">{t.label}</div>
                  <div className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {t.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Table Mode Input */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <button
            onClick={() => {
              setIsCustomMode(!isCustomMode);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              isCustomMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Custom Table Mode</span>
          </button>

          {isCustomMode && (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Enter Supabase table name (e.g. system_logs)..."
                value={customTableName}
                onChange={(e) => setCustomTableName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchTableData();
                }}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={fetchTableData}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-extrabold text-xs hover:bg-slate-800 transition-all"
              >
                Load Table
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls Bar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={`Filter ${activeTableName} rows...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="text-xs text-slate-500 font-bold px-2 whitespace-nowrap">
            {totalCount} total rows
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setIsBulkDeleteOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Record</span>
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-bold text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Fetching table "{activeTableName}" records...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm">
            No records found in "{activeTableName}". Click "Add New Record" to insert your first row!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-16 text-center">Actions</th>
                  {columns.map((col) => (
                    <th key={col} className="p-3 font-extrabold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((row, idx) => {
                  const rowId = String(row.id || idx);
                  const isChecked = selectedIds.has(rowId);

                  return (
                    <tr
                      key={rowId}
                      className={`hover:bg-indigo-50/40 transition-colors ${isChecked ? 'bg-indigo-50/60' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(rowId)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingRecord(row)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {columns.map((col) => (
                        <td key={col} className="p-3 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {renderCellContent(row[col], col)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-bold">
          <div className="flex items-center gap-2">
            <span>Show rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Page {page} of {Math.ceil(totalCount / pageSize) || 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(totalCount / pageSize)}
                className="p-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT RECORD MODAL */}
      {(isAddModalOpen || editingRecord) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold">
                  {editingRecord ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">
                    {editingRecord ? `Edit Record #${editingRecord.id}` : `Add New Record to "${activeTableName}"`}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Modify database values directly</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseRawJsonMode(!useRawJsonMode)}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all ${
                    useRawJsonMode
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {useRawJsonMode ? 'Switch to Form' : 'Raw JSON Mode'}
                </button>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={editingRecord ? handleUpdateRecord : handleCreateRecord} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {useRawJsonMode ? (
                <div className="space-y-2">
                  <label className="font-extrabold text-slate-700 block">JSON Payload</label>
                  <textarea
                    rows={12}
                    value={rawJsonInput}
                    onChange={(e) => setRawJsonInput(e.target.value)}
                    className="w-full p-3 font-mono bg-slate-950 text-emerald-400 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400">Ensure payload is valid JSON before saving.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {columns.map((col) => {
                    const isId = col === 'id';
                    const isBool = col === 'active';
                    const isTypeSelect = col === 'type';
                    const isRoleSelect = col === 'role';
                    const isBranchSelect = col === 'branch_name' && branches.length > 0;

                    return (
                      <div key={col} className={`space-y-1.5 ${col.includes('photo') ? 'sm:col-span-2' : ''}`}>
                        <label className="font-extrabold text-slate-700 capitalize flex items-center justify-between">
                          <span>{col}</span>
                          {isId && editingRecord && <span className="text-[10px] text-slate-400">(Primary Key)</span>}
                        </label>

                        {isBool ? (
                          <select
                            value={String(formData[col] ?? true)}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value === 'true' })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="true">True (Active)</option>
                            <option value="false">False (Inactive)</option>
                          </select>
                        ) : isTypeSelect ? (
                          <select
                            value={formData[col] || 'IN'}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="IN">IN</option>
                            <option value="OUT">OUT</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        ) : isRoleSelect ? (
                          <select
                            value={formData[col] || 'ADMIN'}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPERADMIN">SUPERADMIN</option>
                          </select>
                        ) : isBranchSelect ? (
                          <select
                            value={formData[col] || ''}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select Branch...</option>
                            {branches.map((b) => (
                              <option key={b.id || b.name} value={b.name}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        ) : col.includes('photo') || col.includes('url') ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={formData[col] || ''}
                              onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                              placeholder="URL or Base64 data string..."
                              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {formData[col] && formData[col].startsWith('data:image/') && (
                              <img src={formData[col]} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-slate-300 shadow-2xs" />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            disabled={isId && Boolean(editingRecord)}
                            value={formData[col] ?? ''}
                            onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                            placeholder={`Enter ${col}...`}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-md transition-all"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingRecord ? 'Save Changes' : 'Insert Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE DELETE CONFIRM MODAL */}
      {deletingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Delete Record Confirmation</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Are you sure you want to permanently delete record #{deletingRecord.id} from table "{activeTableName}"?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecord}
                disabled={loading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRM MODAL */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Bulk Delete {selectedIds.size} Records?</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                This will permanently delete {selectedIds.size} selected rows from "{activeTableName}". This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsBulkDeleteOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-extrabold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={loading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete {selectedIds.size} Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 p-2">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-300 hover:text-white rounded-full z-10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewImage} alt="Full Preview" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
