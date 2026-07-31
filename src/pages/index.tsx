import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Branch, Employee, AttendanceLog } from '../types';
import { getHaversineDistance, detectPhotoSource } from '../lib/attendance';
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  LogOut, 
  AlertTriangle, 
  RefreshCw, 
  User, 
  Building2, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Upload
} from 'lucide-react';

export default function IndexPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [employeeInfo, setEmployeeInfo] = useState<Employee | null>(null);
  const [lastStatus, setLastStatus] = useState<'IN' | 'OUT' | null>(null);
  const [lastPunchTime, setLastPunchTime] = useState<string | null>(null);

  const [punchType, setPunchType] = useState<'IN' | 'OUT'>('IN');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<'LIVE (Camera)' | 'UPLOADED'>('LIVE (Camera)');
  const [verificationDelay, setVerificationDelay] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const [cameraStartTime, setCameraStartTime] = useState<number>(0);

  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial branches and check URL query params for QR code scanning
  useEffect(() => {
    fetchBranches();
    
    // Check if employee ID is in URL query parameter (?id=EMP001)
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');
    if (urlId) {
      setSelectedEmpId(urlId.replace(/['"]+/g, '').trim());
    }
  }, []);

  const fetchBranches = async () => {
    try {
      let { data, error } = await supabase.from('branches').select('*').order('name');
      if (error) throw error;

      if (!data || data.length === 0) {
        // Auto-seed default branches if database is empty
        await supabase.from('branches').upsert([
          { id: '1', name: 'PNK', lat: 9.3671, lng: 78.9489, radius: 100 },
          { id: '2', name: 'Main Branch', lat: 9.3670, lng: 78.9488, radius: 100 }
        ]);
        const refetch = await supabase.from('branches').select('*').order('name');
        data = refetch.data || [];
      }

      // Ensure PNK employees exist
      await seedSampleEmployees();

      setBranches(data || []);
      if (data && data.length > 0 && !selectedBranch) {
        setSelectedBranch(data[0].name);
      }
    } catch (err: any) {
      console.error('Error fetching branches:', err);
    }
  };

  const seedSampleEmployees = async () => {
    try {
      const sampleEmps = [
        { id: 'PNK-059', name: 'ANISH', branch_name: 'PNK', active: true },
        { id: 'PNK-056', name: 'IJAS', branch_name: 'PNK', active: true },
        { id: 'PNK-041', name: 'GEETHA', branch_name: 'PNK', active: true },
        { id: 'PNK-036', name: 'BANUMATHI', branch_name: 'PNK', active: true }
      ];

      for (const emp of sampleEmps) {
        await supabase.from('employees').upsert(emp, { onConflict: 'id' });
      }
    } catch (e) {
      console.error('Seed employees error:', e);
    }
  };

  // Fetch employees when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchEmployeesByBranch(selectedBranch);
    } else {
      setEmployees([]);
    }
  }, [selectedBranch]);

  const fetchEmployeesByBranch = async (branchName: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('branch_name', branchName)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
      setSelectedEmpId('');
      setEmployeeInfo(null);
      setLastStatus(null);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
    }
  };

  // Check employee status when employee selected
  useEffect(() => {
    if (selectedEmpId) {
      const emp = employees.find((e) => e.id === selectedEmpId);
      setEmployeeInfo(emp || null);
      checkEmployeeStatus(selectedEmpId);
    } else {
      setEmployeeInfo(null);
      setLastStatus(null);
    }
  }, [selectedEmpId]);

  const checkEmployeeStatus = async (empId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('emp_id', empId)
        .neq('type', 'REJECTED')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const latest = data[0];
        setLastStatus(latest.type as 'IN' | 'OUT');
        setLastPunchTime(new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (latest.type === 'IN') {
          setPunchType('OUT');
        } else {
          setPunchType('IN');
        }
      } else {
        setLastStatus(null);
        setLastPunchTime(null);
        setPunchType('IN');
      }
    } catch (err: any) {
      console.error('Error checking employee status:', err);
    }
  };

  const handleCameraClick = () => {
    setCameraStartTime(Date.now());
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const now = Date.now();
    const delay = Number(((now - cameraStartTime) / 1000).toFixed(1));
    setFileName(file.name);
    setVerificationDelay(delay);

    const { source } = detectPhotoSource(file.name, delay);
    setPhotoSource(source);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_size = 600;

        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedUrl = canvas.toDataURL('image/jpeg', 0.65);
        setPhotoDataUrl(compressedUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const fetchGPSLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    setFetchingLocation(true);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setFetchingLocation(false);
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFetchingLocation(false);
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setLocation(coords);
          resolve(coords);
        },
        (err) => {
          setFetchingLocation(false);
          reject(new Error('GPS Error: Please enable location services and move to an open area.'));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const handlePunch = async () => {
    setMessage(null);

    if (!selectedEmpId || !employeeInfo) {
      setMessage({ type: 'error', text: 'Please select an employee first.' });
      return;
    }

    if (!photoDataUrl) {
      setMessage({ type: 'error', text: 'Identity Verification Selfie is required!' });
      return;
    }

    setLoading(true);

    try {
      // 1. Get GPS Location & Perform Geofence Validation
      const coords = await fetchGPSLocation();
      const currentBranch = branches.find((b) => b.name === selectedBranch);

      let calcDist = 0;
      let radius = 100;

      if (currentBranch) {
        radius = Number(currentBranch.radius || 100);
        calcDist = getHaversineDistance(coords.lat, coords.lng, currentBranch.lat, currentBranch.lng);
        setDistance(Math.round(calcDist));

        if (calcDist > radius) {
          setIsWithinRadius(false);
          // Log rejected record to Supabase
          await supabase.from('attendance_logs').insert([
            {
              emp_id: employeeInfo.id,
              emp_name: employeeInfo.name,
              branch_name: selectedBranch,
              type: 'REJECTED',
              timestamp: new Date().toISOString(),
              lat: coords.lat,
              lng: coords.lng,
              distance_m: Math.round(calcDist),
              photo_url: photoDataUrl,
              photo_source: photoSource,
              file_name: fileName,
              verification_delay: verificationDelay,
              status: 'Outside Radius',
              accuracy: coords.accuracy,
              created_by: 'Mobile App',
            },
          ]);

          setMessage({
            type: 'error',
            text: `Punch Denied: You are ${Math.round(calcDist)}m away from ${selectedBranch} (Radius limit: ${radius}m).`,
          });
          setLoading(false);
          return;
        }
      }

      setIsWithinRadius(true);

      // 2. 5-Minute Cooldown Check
      const { data: latestLogs } = await supabase
        .from('attendance_logs')
        .select('timestamp')
        .eq('emp_id', employeeInfo.id)
        .neq('type', 'REJECTED')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (latestLogs && latestLogs.length > 0) {
        const lastTime = new Date(latestLogs[0].timestamp).getTime();
        const diffMinutes = (Date.now() - lastTime) / (1000 * 60);
        if (diffMinutes < 5) {
          setMessage({
            type: 'error',
            text: `Wait Restriction: 5-minute cooldown active. Please wait ${Math.ceil(5 - diffMinutes)} more minute(s).`,
          });
          setLoading(false);
          return;
        }
      }

      // 3. Save Valid Attendance Punch to Database (Base64 Selfie stored directly)
      const { error: insertError } = await supabase.from('attendance_logs').insert([
        {
          emp_id: employeeInfo.id,
          emp_name: employeeInfo.name,
          branch_name: selectedBranch,
          type: punchType,
          timestamp: new Date().toISOString(),
          lat: coords.lat,
          lng: coords.lng,
          distance_m: Math.round(calcDist),
          photo_url: photoDataUrl,
          photo_source: photoSource,
          file_name: fileName,
          verification_delay: verificationDelay,
          status: 'Present',
          accuracy: coords.accuracy,
          created_by: 'Mobile App',
        },
      ]);

      if (insertError) throw insertError;

      setMessage({
        type: 'success',
        text: `✅ SHIFT ${punchType} Marked Successfully for ${employeeInfo.name}! Ready for next user.`,
      });

      // Clear all fields for shared device kiosk usage
      setSelectedEmpId('');
      setEmployeeInfo(null);
      setPhotoDataUrl(null);
      setFileName('');
      setVerificationDelay(0);
      setLocation(null);
      setDistance(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Punch Error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to mark attendance. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-1 py-2">
        <div className="inline-flex items-center gap-2 text-indigo-600 font-extrabold text-2xl tracking-tight">
          <ShieldCheck className="w-7 h-7" />
          <span>AQSA ATTENDANCE</span>
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Professional Geofenced Portal
        </p>
      </div>

      {/* Message Banners */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-start gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : message.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed">{message.text}</div>
        </div>
      )}

      {/* Main Step Form Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
        {/* Step 1: Branch Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-indigo-600" />
            1. Select Branch Location
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl text-sm font-semibold text-slate-900 outline-none transition-all"
          >
            {branches.map((b) => (
              <option key={b.id || b.name} value={b.name}>
                📍 {b.name} ({b.radius}m radius)
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Employee Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-indigo-600" />
            2. Select Employee Name
          </label>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl text-sm font-semibold text-slate-900 outline-none transition-all"
          >
            <option value="">👤 Choose your name...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.id})
              </option>
            ))}
          </select>
        </div>

        {/* Selected Employee Card Preview & Live Status */}
        {employeeInfo && (
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Employee Active</div>
                <div className="text-base font-extrabold text-slate-900">{employeeInfo.name}</div>
                <div className="text-xs text-slate-500">ID: {employeeInfo.id}</div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${
                    lastStatus === 'IN'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : lastStatus === 'OUT'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {lastStatus ? `STATUS: SHIFT-${lastStatus}` : 'FIRST SHIFT TODAY'}
                </span>
                {lastPunchTime && (
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Last: {lastPunchTime}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shift IN / OUT Toggle Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPunchType('IN')}
            className={`py-3.5 px-4 rounded-xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 border transition-all ${
              punchType === 'IN'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-[1.02]'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>SHIFT IN</span>
          </button>
          <button
            type="button"
            onClick={() => setPunchType('OUT')}
            className={`py-3.5 px-4 rounded-xl font-extrabold text-xs flex flex-col items-center justify-center gap-1 border transition-all ${
              punchType === 'OUT'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20 scale-[1.02]'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <LogOut className="w-5 h-5" />
            <span>SHIFT OUT</span>
          </button>
        </div>

        {/* Step 3: Photo Selfie Capture */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-indigo-600" />
              3. Identity Verification Photo
            </span>
            {photoSource && photoDataUrl && (
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  photoSource === 'LIVE (Camera)'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {photoSource} ({verificationDelay}s)
              </span>
            )}
          </label>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="user"
            onChange={handleFileChange}
            className="hidden"
          />

          {photoDataUrl ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-indigo-600 bg-slate-900 group">
              <img src={photoDataUrl} alt="Selfie preview" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={handleCameraClick}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold rounded-lg backdrop-blur-xs transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake Selfie
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCameraClick}
              className="w-full h-36 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl bg-slate-50/70 hover:bg-indigo-50/30 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-slate-700">Tap to Take Selfie Photo</div>
                <div className="text-[10px] text-slate-400">Live camera verification required</div>
              </div>
            </button>
          )}
        </div>

        {/* Location Preview Tag */}
        {distance !== null && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              isWithinRadius
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>
              Distance to {selectedBranch}: {distance}m ({isWithinRadius ? 'Inside geofence' : 'Outside limit'})
            </span>
          </div>
        )}

        {/* Submit Punch Button */}
        <button
          type="button"
          onClick={handlePunch}
          disabled={loading || fetchingLocation || !selectedEmpId}
          className={`w-full py-4 px-6 rounded-xl font-extrabold text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 ${
            punchType === 'IN'
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
          } ${loading || !selectedEmpId ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.99]'}`}
        >
          {loading || fetchingLocation ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying GPS & Saving...</span>
            </>
          ) : (
            <>
              <span>MARK SHIFT-{punchType} ATTENDANCE</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
