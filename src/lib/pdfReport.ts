import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AttendanceLog, DailySummaryRow } from '../types';
import { formatISTDateTime, formatISTTime } from './dateUtils';

// --- IMAGE PROCESSING HELPERS ---

/**
 * Converts a URL to a Base64 string. 
 * This is crucial because html2canvas often fails to "see" external URLs.
 */
async function toDataURL(url: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return trimmed;

  // Try fetching via proxy
  try {
    const res = await fetch('/api/proxy-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.dataUrl) return json.dataUrl;
    }
  } catch (err) {
    console.warn('Proxy fetch failed, trying direct conversion');
  }

  // Fallback: Direct canvas conversion
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = trimmed;
  });
}

async function preparePhoto(url?: string): Promise<string> {
  return await toDataURL(url || '');
}

// --- PDF RENDERING ENGINE ---

async function renderHtmlToCanvas(htmlContent: string, widthPx: number): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${widthPx}px`;
  container.style.background = 'white';
  container.innerHTML = `
    <style>
      .pdf-root { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e293b; color: white; padding: 10px; font-size: 12px; border: 1px solid #334155; }
      td { border: 1px solid #e2e8f0; padding: 8px; font-size: 11px; vertical-align: top; }
      .punch-card { 
        display: inline-block; 
        width: 130px; 
        border: 1px solid #cbd5e1; 
        border-radius: 6px; 
        margin: 4px; 
        padding: 5px; 
        text-align: center; 
        background: #ffffff;
      }
      .punch-img { width: 120px; height: 120px; border-radius: 4px; object-fit: cover; display: block; margin: 0 auto; background: #f1f5f9; }
      .label-in { color: #059669; font-weight: 800; font-size: 10px; margin-top: 4px; }
      .label-out { color: #dc2626; font-weight: 800; font-size: 10px; margin-top: 4px; }
      .time-text { font-weight: 700; font-size: 10px; color: #1e3a8a; }
    </style>
    <div class="pdf-root">${htmlContent}</div>
  `;
  document.body.appendChild(container);

  // FORCE IMAGE DECODING: This tells the browser "do not continue until these pixels are visible"
  const images = Array.from(container.getElementsByTagName('img'));
  await Promise.all(images.map(async (img) => {
    try {
      if (img.src) {
        await img.decode(); 
      }
    } catch (e) {
      console.error("Image decode failed", e);
    }
  }));

  // Wait a moment for the layout to settle
  await new Promise(r => setTimeout(r, 1500));

  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    allowTaint: false,
    backgroundColor: '#ffffff',
  });

  document.body.removeChild(container);
  return canvas;
}

function saveCanvasToPdf(canvas: HTMLCanvasElement, filename: string) {
  const imgData = canvas.toDataURL('image/jpeg', 0.9);
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
  heightLeft -= pdfPageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfPageHeight;
  }
  pdf.save(filename);
}

// --- EXPORTED FUNCTIONS ---

// 1. Standard Summary PDF
export async function generateFormattedPDF(data: DailySummaryRow[], dateStr: string) {
  let html = `
    <h1 style="color:#1e3a8a;">AQSA ATTENDANCE SUMMARY - ${dateStr}</h1>
    <table>
      <thead>
        <tr><th>Employee</th><th>Branch</th><th>Intervals (IN/OUT)</th><th>Hrs</th><th>OT</th><th>Status</th></tr>
      </thead>
      <tbody>
  `;
  data.forEach(row => {
    const ints = [row.in1, row.out1, row.in2, row.out2, row.in3, row.out3].filter(Boolean).join(' / ');
    html += `
      <tr>
        <td><b>${row.name}</b><br>ID: ${row.empId}</td>
        <td align="center">${row.branch}</td>
        <td align="center">${ints || '-'}</td>
        <td align="center"><b>${row.totalHours}h</b></td>
        <td align="center">${row.ot}h</td>
        <td align="center">${row.status}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  const canvas = await renderHtmlToCanvas(html, 1100);
  saveCanvasToPdf(canvas, `AQSA_Summary_${dateStr}.pdf`);
}

// 2. Selfie Proofs PDF (FIXED VERSION)
export async function generateSelfiePDF(data: DailySummaryRow[], dateStr: string) {
  // We process all photos into Base64 before starting
  const rows = await Promise.all(data.map(async row => ({
    ...row,
    img1: await preparePhoto(row.in1Photo), img2: await preparePhoto(row.out1Photo),
    img3: await preparePhoto(row.in2Photo), img4: await preparePhoto(row.out2Photo),
    img5: await preparePhoto(row.in3Photo), img6: await preparePhoto(row.out3Photo),
    img7: await preparePhoto(row.in4Photo), img8: await preparePhoto(row.out4Photo),
    img9: await preparePhoto(row.in5Photo), img10: await preparePhoto(row.out5Photo),
  })));

  let html = `
    <h1 style="color:#1e3a8a; border-bottom: 3px solid #1e3a8a;">AQSA SELFIE VERIFICATION REPORT - ${dateStr}</h1>
    <table>
      <thead>
        <tr><th width="15%">Employee Details</th><th width="75%">Shift Punches & Selfie Proofs</th><th width="10%">Status</th></tr>
      </thead>
      <tbody>
  `;

  rows.forEach(row => {
    const makeBox = (label: string, time: string, base64: string) => {
      if (!time && (!base64 || base64.length < 100)) return '';
      const isIN = label.includes('IN');
      const imgTag = base64.length > 100 
        ? `<img src="${base64}" class="punch-img" />`
        : `<div class="punch-img" style="line-height:120px; color:#94a3b8; font-size:10px; border:1px dashed #cbd5e1;">No Photo</div>`;
      
      return `
        <div class="punch-card">
          ${imgTag}
          <div class="${isIN ? 'label-in' : 'label-out'}">${label}</div>
          <div class="time-text">${time || '--:--'}</div>
        </div>
      `;
    };

    let boxes = '';
    boxes += makeBox('IN 1', row.in1, row.img1);
    boxes += makeBox('OUT 1', row.out1, row.img2);
    if (row.in2 || row.img3) boxes += makeBox('IN 2', row.in2, row.img3);
    if (row.out2 || row.img4) boxes += makeBox('OUT 2', row.out2, row.img4);
    if (row.in3 || row.img5) boxes += makeBox('IN 3', row.in3, row.img5);
    if (row.out3 || row.img6) boxes += makeBox('OUT 3', row.out3, row.img6);
    if (row.in4 || row.img7) boxes += makeBox('IN 4', row.in4, row.img7);
    if (row.out4 || row.img8) boxes += makeBox('OUT 4', row.out4, row.img8);

    html += `
      <tr>
        <td><b>${row.name}</b><br>ID: ${row.empId}<br>Branch: ${row.branch}</td>
        <td align="center">${boxes || '<i style="color:#94a3b8">No activity recorded</i>'}</td>
        <td align="center"><b>${row.status}</b><br>${row.totalHours}h</td>
      </tr>`;
  });

  html += `</tbody></table>`;
  // Width is 1300 to give space for all photos horizontally
  const canvas = await renderHtmlToCanvas(html, 1300);
  saveCanvasToPdf(canvas, `AQSA_Selfie_Verification_${dateStr}.pdf`);
}

// 3. Live Logs PDF
export async function generateLiveSelfiePDF(data: AttendanceLog[], dateStr: string) {
  const logs = await Promise.all(data.map(async l => ({
    ...l,
    base64: await preparePhoto(l.photo_url)
  })));

  let html = `
    <h1 style="color:#1e3a8a;">AQSA LIVE VERIFICATION LOGS - ${dateStr}</h1>
    <table>
      <thead>
        <tr><th>Employee</th><th>Branch</th><th>Punch Info</th><th>Photo Proof</th></tr>
      </thead>
      <tbody>
  `;
  logs.forEach(l => {
    const img = l.base64.length > 100 
      ? `<img src="${l.base64}" style="width:150px; height:150px; border-radius:8px; border:1px solid #cbd5e1;" />`
      : `<div style="width:150px; height:150px; background:#f1f5f9; border:1px dashed #cbd5e1; line-height:150px;">No Photo</div>`;
    
    html += `
      <tr>
        <td align="center"><b>${l.emp_name}</b><br>ID: ${l.emp_id}</td>
        <td align="center">${l.branch_name}</td>
        <td align="center"><b>${l.type}</b><br>${formatISTTime(l.timestamp, true)}</td>
        <td align="center">${img}</td>
      </tr>`;
  });
  html += `</tbody></table>`;
  const canvas = await renderHtmlToCanvas(html, 1100);
  saveCanvasToPdf(canvas, `AQSA_Live_Logs_${dateStr}.pdf`);
}