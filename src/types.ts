export interface Branch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  created_at?: string;
}

export interface Employee {
  id: string;
  name: string;
  branch_name: string;
  active: boolean;
  photo_url?: string;
  created_at?: string;
}

export interface AttendanceLog {
  id: string;
  emp_id: string;
  emp_name: string;
  branch_name: string;
  type: 'IN' | 'OUT' | 'REJECTED';
  timestamp: string;
  lat?: number;
  lng?: number;
  distance_m?: number;
  photo_url?: string;
  photo_source?: string;
  file_name?: string;
  verification_delay?: number;
  status?: string;
  accuracy?: number;
  created_by?: string;
  created_at?: string;
}

export interface AdminUser {
  id: string;
  email_or_username: string;
  password?: string;
  role: 'ADMIN' | 'SUPERADMIN';
  active: boolean;
}

export interface DailySummaryRow {
  date: string;
  empId: string;
  name: string;
  branch: string;
  in1: string; out1: string;
  in2: string; out2: string;
  in3: string; out3: string;
  in4: string; out4: string;
  in5: string; out5: string;
  in1Photo?: string; out1Photo?: string;
  in2Photo?: string; out2Photo?: string;
  in3Photo?: string; out3Photo?: string;
  in4Photo?: string; out4Photo?: string;
  in5Photo?: string; out5Photo?: string;
  totalHours: string;
  ot: string;
  status: string;
}

export interface MonthlySummaryRow {
  month: string;
  empId: string;
  name: string;
  branch: string;
  presentDays: number;
  absentDays: number;
  totalHours: string;
  otHours: string;
  missingDays: number;
}
