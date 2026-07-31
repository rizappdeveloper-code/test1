import JSZip from 'jszip';
import { supabase } from './supabase';
import { AttendanceLog } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getISTDateRangeISO, formatISTDate, formatISTTime24 } from './dateUtils';

// Helper to convert photo URL (Base64 or external/relative URL) into Blob / ArrayBuffer
async function fetchImageBlob(url: string): Promise<{ data: ArrayBuffer; extension: string } | null> {
  if (!url) return null;

  try {
    if (url.startsWith('data:')) {
      const mimeMatch = url.match(/^data:(image\/\w+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      const base64Data = url.replace(/^data:image\/\w+;base64,/, '');
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return { data: bytes.buffer, extension: ext };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const blob = await res.blob();
    const ext = blob.type.split('/')[1] || 'jpg';
    const arrayBuffer = await blob.arrayBuffer();
    return { data: arrayBuffer, extension: ext };
  } catch (err) {
    console.warn('Failed to fetch image blob:', url, err);
    return null;
  }
}

export interface BatchDownloadOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  branchName?: string;
  empId?: string;
  onProgress?: (current: number, total: number, statusText: string) => void;
}

// 1. Download all selfies as a single organized .ZIP file
export async function downloadSelfiesZip(options: BatchDownloadOptions): Promise<{ count: number }> {
  const { startDate, endDate, branchName, empId, onProgress } = options;

  if (onProgress) onProgress(0, 0, 'Fetching attendance logs...');

  const { startISO } = getISTDateRangeISO(startDate);
  const { endISO } = getISTDateRangeISO(endDate);

  let query = supabase
    .from('attendance_logs')
    .select('*')
    .gte('timestamp', startISO)
    .lte('timestamp', endISO)
    .order('timestamp', { ascending: true });

  if (branchName) query = query.eq('branch_name', branchName);
  if (empId) query = query.eq('emp_id', empId);

  const { data: logs, error } = await query;
  if (error) throw new Error(`Database query error: ${error.message}`);

  // Filter logs that have selfie photos
  const logsWithPhoto = (logs || []).filter((l: AttendanceLog) => l.photo_url && l.photo_url.trim() !== '');

  if (logsWithPhoto.length === 0) {
    throw new Error('No selfie photos found for the selected date range and filters.');
  }

  const zip = new JSZip();
  const folderName = `Selfies_${startDate}_to_${endDate}`;
  const zipFolder = zip.folder(folderName) || zip;

  let downloadedCount = 0;
  const total = logsWithPhoto.length;

  for (let i = 0; i < total; i++) {
    const log = logsWithPhoto[i];
    if (onProgress) {
      onProgress(
        i + 1,
        total,
        `Downloading selfie ${i + 1} of ${total} (${log.emp_name || log.emp_id})...`
      );
    }

    const imgResult = await fetchImageBlob(log.photo_url);
    if (imgResult) {
      const dateStr = log.timestamp ? formatISTDate(log.timestamp) : startDate;
      const timeStr = log.timestamp
        ? formatISTTime24(log.timestamp).replace(/:/g, '-')
        : '00-00-00';
      const cleanEmpName = (log.emp_name || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanBranch = (log.branch_name || 'BRANCH').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${dateStr}_${cleanBranch}_${log.emp_id}_${cleanEmpName}_${log.type}_${timeStr}.${imgResult.extension}`;

      zipFolder.file(fileName, imgResult.data);
      downloadedCount++;
    }
  }

  if (downloadedCount === 0) {
    throw new Error('Could not retrieve image data for the selected selfies.');
  }

  if (onProgress) onProgress(total, total, 'Creating ZIP archive...');

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `AQSA_Selfies_${startDate}_to_${endDate}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return { count: downloadedCount };
}
