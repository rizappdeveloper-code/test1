import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AttendanceLog, DailySummaryRow } from '../types';
import { formatISTDateTime, formatISTTime } from './dateUtils';

// Helper to convert images to base64 data URLs for clean canvas rendering
async function toDataURL(url: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();

  // If already a valid data URI
  if (trimmed.startsWith('data:')) return trimmed;

  // Resolve relative URLs (e.g., /uploads/...)
  let fullUrl = trimmed;
  if (trimmed.startsWith('/')) {
    fullUrl = window.location.origin + trimmed;
  }

  const isHttpUrl = fullUrl.startsWith('http://') || fullUrl.startsWith('https://');

  if (isHttpUrl) {
    try {
      const res = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.dataUrl && (json.dataUrl.startsWith('data:image/') || json.dataUrl.startsWith('data:'))) {
          return json.dataUrl;
        }
      }
    } catch (err) {
      console.warn('Proxy image fetch error:', err);
    }

    // Fallback to client-side Image canvas conversion
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 200;
          canvas.height = img.naturalHeight || img.height || 200;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
            return;
          }
        } catch (e) {}
        resolve(fullUrl);
      };
      img.onerror = () => resolve(fullUrl);
      img.src = fullUrl;
    });
  }

  // Handle raw base64 strings
  if (trimmed.startsWith('iVBORw0KG')) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith('R0lGOD')) return `data:image/gif;base64,${trimmed}`;
  if (trimmed.startsWith('UklGR')) return `data:image/webp;base64,${trimmed}`;
  const cleanBase64 = trimmed.startsWith('/9j/') ? trimmed : trimmed.replace(/^[^a-zA-Z0-9+/=]+/, '');
  return `data:image/jpeg;base64,${cleanBase64}`;
}

// Safely prepares image URL with fallback to original string if conversion yields empty
async function preparePhoto(url?: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  const dataUrl = await toDataURL(trimmed);
  return dataUrl || trimmed;
}

// Render HTML content safely inside an iframe to avoid Tailwind v4 oklch CSS conflicts
async function renderHtmlToCanvas(htmlContent: string, widthPx: number, scale = 2): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = `${widthPx}px`;
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    iframe.style.opacity = '1';
    iframe.style.visibility = 'visible';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      return reject(new Error('Failed to access iframe document'));
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
            body { margin: 0; padding: 25px; background: #ffffff; color: #1e293b; width: ${widthPx}px; }
            img { display: block; margin: 0 auto; max-width: 100%; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    doc.close();

    setTimeout(async () => {
      try {
        const body = doc.body;

        // Force browser layout update
        body.getBoundingClientRect();

        // Wait for all images in iframe to fully decode & paint to prevent decoding lag
        const images = Array.from(doc.images);
        await Promise.all(
          images.map(async (img) => {
            try {
              if (img.decode) {
                await img.decode();
              }
            } catch (e) {
              console.warn('Image decode wait error:', e);
            }
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((res) => {
              let done = false;
              const finish = () => {
                if (!done) {
                  done = true;
                  res(null);
                }
              };
              img.onload = finish;
              img.onerror = finish;
              setTimeout(finish, 3000);
            });
          })
        );

        // Extra delay to ensure browser rendering pipeline finishes painting image pixels
        await new Promise((res) => setTimeout(res, 400));

        const fullHeight = Math.max(body.scrollHeight, body.offsetHeight, 600);
        iframe.style.height = `${fullHeight}px`;

        const canvas = await html2canvas(body, {
          scale,
          useCORS: true,
          allowTaint: false, // Set to false so canvas can be safely exported via toDataURL without SecurityError
          logging: false,
          width: widthPx,
          height: fullHeight,
          windowWidth: widthPx,
          windowHeight: fullHeight,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
        });

        document.body.removeChild(iframe);
        resolve(canvas);
      } catch (err) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        reject(err);
      }
    }, 300);
  });
}

function saveCanvasToPdf(canvas: HTMLCanvasElement, filename: string) {
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  if (imgHeight <= pdfPageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  } else {
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfPageHeight;

    while (heightLeft > 0) {
      position -= pdfPageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfPageHeight;
    }
  }

  pdf.save(filename);
}

// 1. Generate Standard Formatted Summary PDF (Matching GAS generateFormattedPDF)
export async function generateFormattedPDF(data: DailySummaryRow[], dateStr: string) {
  let html = `
    <div style="border-bottom: 4px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 800;">AQSA ATTENDANCE REPORT</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Official Summary log sheets</p>
          </td>
          <td align="right">
            <div style="background: #f1f5f9; padding: 10px 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; width: 140px;">
              <span style="font-size: 10px; color: #64748b; font-weight: 800; display: block;">REPORT DATE</span>
              <span style="font-size: 16px; color: #1e3a8a; font-weight: 800;">${dateStr}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 20px; font-size: 11px; color: #475569;">
      <strong>Type:</strong> Daily Summary Report &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Total Records:</strong> ${data.length} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Generated:</strong> ${formatISTDateTime(new Date())}
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 12px;">
          <th style="padding: 10px; border: 1px solid #334155; text-align: left; width: 25%;">Employee Details</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 15%;">Branch</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 30%;">Work Intervals (IN / OUT)</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 10%;">Hrs</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 10%;">OT</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 10%;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    let statusColor = '#059669';
    let statusBg = '#ecfdf5';
    if (row.status === 'Absent') {
      statusColor = '#dc2626';
      statusBg = '#fef2f2';
    } else if (row.status === 'Missing OUT') {
      statusColor = '#d97706';
      statusBg = '#fffbeb';
    }

    const intervals = [];
    if (row.in1 || row.out1) intervals.push(`${row.in1 || '-'} / ${row.out1 || '-'}`);
    if (row.in2 || row.out2) intervals.push(`${row.in2 || '-'} / ${row.out2 || '-'}`);
    if (row.in3 || row.out3) intervals.push(`${row.in3 || '-'} / ${row.out3 || '-'}`);
    if (row.in4 || row.out4) intervals.push(`${row.in4 || '-'} / ${row.out4 || '-'}`);
    if (row.in5 || row.out5) intervals.push(`${row.in5 || '-'} / ${row.out5 || '-'}`);
    const intervalsStr = intervals.length > 0 ? intervals.join('<br>') : '-';

    html += `
      <tr style="background-color: ${bgColor}; font-size: 11px; color: #1e293b;">
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #1e293b; font-size: 12px;">${row.name}</div>
          <div style="color: #64748b; font-size: 10px;">ID: ${row.empId}</div>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">${row.branch}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-size: 10px; font-family: monospace;">${intervalsStr}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #1e3a8a;">${row.totalHours}h</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #ea580c;">${row.ot}h</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">
          <span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 8px; border-radius: 10px; font-weight: 800; font-size: 10px; border: 1px solid ${statusColor}44; display: inline-block;">
            ${row.status}
          </span>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center;">
      Generated from AQSA Enterprise Portal | System Key: AQSA-PDF-${Math.random().toString(36).substring(2, 9).toUpperCase()}
    </div>
  `;

  const canvas = await renderHtmlToCanvas(html, 1050, 2);
  saveCanvasToPdf(canvas, `AQSA_Daily_Summary_${dateStr}.pdf`);
}

// 2. Generate PDF with Selfie Proofs (Matching GAS downloadFilteredPDFWithSelfies & Live Selfie PDF format)
export async function generateSelfiePDF(data: any[], dateStr: string) {
  if (!data || data.length === 0) return;

  // Normalize input data into flat punch items (like AttendanceLog)
  const punchItems: Array<{
    emp_name: string;
    emp_id: string;
    branch_name: string;
    type: string;
    timestamp: string;
    photo_url: string;
    distance_m?: number;
  }> = [];

  // Check if input is DailySummaryRow[] or AttendanceLog[]
  const isSummaryRow = 'empId' in data[0] || 'in1' in data[0];

  if (isSummaryRow) {
    (data as DailySummaryRow[]).forEach((row) => {
      let addedAny = false;
      const addPunch = (type: 'IN' | 'OUT', time: string, photo?: string) => {
        if (time || photo) {
          punchItems.push({
            emp_name: row.name,
            emp_id: row.empId,
            branch_name: row.branch,
            type,
            timestamp: time,
            photo_url: photo || '',
          });
          addedAny = true;
        }
      };
      addPunch('IN', row.in1, row.in1Photo);
      addPunch('OUT', row.out1, row.out1Photo);
      addPunch('IN', row.in2, row.in2Photo);
      addPunch('OUT', row.out2, row.out2Photo);
      addPunch('IN', row.in3, row.in3Photo);
      addPunch('OUT', row.out3, row.out3Photo);
      addPunch('IN', row.in4, row.in4Photo);
      addPunch('OUT', row.out4, row.out4Photo);
      addPunch('IN', row.in5, row.in5Photo);
      addPunch('OUT', row.out5, row.out5Photo);

      if (!addedAny) {
        punchItems.push({
          emp_name: row.name,
          emp_id: row.empId,
          branch_name: row.branch,
          type: row.status === 'Absent' ? 'ABSENT' : 'NO LOGS',
          timestamp: '--:--',
          photo_url: '',
        });
      }
    });
  } else {
    // Already AttendanceLog[]
    (data as AttendanceLog[]).forEach((l) => {
      punchItems.push({
        emp_name: l.emp_name,
        emp_id: l.emp_id,
        branch_name: l.branch_name,
        type: l.type,
        timestamp: l.timestamp,
        photo_url: l.photo_url || '',
        distance_m: l.distance_m,
      });
    });
  }

  // Pre-convert images to base64 data URLs with fallbacks
  const processItems = await Promise.all(
    punchItems.map(async (item) => ({
      ...item,
      photoUrlBase64: await preparePhoto(item.photo_url),
    }))
  );

  let html = `
    <div style="border-bottom: 4px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 800;">AQSA DAILY ATTENDANCE & SELFIE PROOFS REPORT</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">Daily Summary Verification Logs with Selfie Photos</p>
          </td>
          <td align="right">
            <div style="background: #f1f5f9; padding: 10px 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; width: 140px;">
              <span style="font-size: 10px; color: #64748b; font-weight: 800; display: block;">REPORT DATE</span>
              <span style="font-size: 16px; color: #1e3a8a; font-weight: 800;">${dateStr}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 20px; font-size: 11px; color: #475569;">
      <strong>Report Type:</strong> Daily Verification Report with Selfie Proofs &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Total Records:</strong> ${processItems.length} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Generated:</strong> ${formatISTDateTime(new Date())}
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 12px;">
          <th style="padding: 10px; border: 1px solid #334155; text-align: left; width: 25%;">Employee Details</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 15%;">Branch</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 22%;">Punch Information</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 15%;">Type</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 23%;">Selfie Photo Proof</th>
        </tr>
      </thead>
      <tbody>
  `;

  processItems.forEach((item, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const isIN = item.type === 'IN';
    const isAbsent = item.type === 'ABSENT' || item.type === 'NO LOGS';
    const typeColor = isAbsent ? '#dc2626' : isIN ? '#059669' : '#dc2626';
    const typeBg = isAbsent ? '#fef2f2' : isIN ? '#ecfdf5' : '#fef2f2';

    const formattedTime = item.timestamp.includes('T')
      ? formatISTTime(item.timestamp, true)
      : item.timestamp || '--:--';

    const photoUrl = item.photoUrlBase64 || item.photo_url || '';
    const validPhoto = photoUrl && photoUrl.trim() !== '' ? photoUrl : null;

    const imgTag = validPhoto
      ? `<img src="${validPhoto}" width="160" height="160" style="width: 160px; height: 160px; object-fit: cover; border-radius: 10px; border: 1.5px solid #cbd5e1; display: block; margin: 0 auto;" />`
      : `<div style="width: 160px; height: 160px; background: #f8fafc; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #94a3b8; border: 1px dashed #cbd5e1; font-weight: bold; margin: 0 auto;">No Photo</div>`;

    const selfieBlock = `
      <div style="text-align: center; padding: 2px;">
        ${imgTag}
        <div style="font-size: 10.5px; font-weight: 800; color: ${typeColor}; margin-top: 5px;">Type: ${item.type}</div>
        <div style="font-size: 10px; font-weight: 700; color: #1e3a8a; margin-top: 2px;">${formattedTime}</div>
      </div>
    `;

    html += `
      <tr style="background-color: ${bgColor}; font-size: 11px; color: #1e293b;">
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: middle;">
          <div style="font-weight: 800; color: #1e293b; font-size: 12px;">${item.emp_name}</div>
          <div style="color: #64748b; font-size: 10px;">ID: ${item.emp_id}</div>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569; vertical-align: middle;">${item.branch_name}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; line-height: 1.4; vertical-align: middle;">
          <div><b>Punch Time:</b> ${formattedTime}</div>
          ${item.distance_m ? `<div style="font-size: 10px; color: #64748b;">Distance: ${item.distance_m}m</div>` : ''}
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle;">
          <span style="background: ${typeBg}; color: ${typeColor}; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 10px; border: 1px solid ${typeColor}44; display: inline-block;">
            SHIFT-${item.type}
          </span>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle;">${selfieBlock}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center;">
      Generated from AQSA Enterprise Portal | Verification Security Key: AQSA-SELFIE-${Math.random().toString(36).substring(2, 9).toUpperCase()}
    </div>
  `;

  const canvas = await renderHtmlToCanvas(html, 1050, 1.5);
  saveCanvasToPdf(canvas, `AQSA_Verification_Selfie_Report_${dateStr}.pdf`);
}

// 3. Generate Live Punch Verification PDF with Selfies (Matching GAS downloadFilteredLivePDFWithSelfies)
export async function generateLiveSelfiePDF(data: AttendanceLog[], dateStr: string) {
  const processLogs = await Promise.all(
    data.map(async (l) => ({
      ...l,
      photoUrlBase64: await preparePhoto(l.photo_url),
    }))
  );

  let html = `
    <div style="border-bottom: 4px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 800;">AQSA LIVE VERIFICATION REPORT</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">Chronological Punch Logs with Selfie Proofs</p>
          </td>
          <td align="right">
            <div style="background: #f1f5f9; padding: 10px 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; width: 140px;">
              <span style="font-size: 10px; color: #64748b; font-weight: 800; display: block;">REPORT DATE</span>
              <span style="font-size: 16px; color: #1e3a8a; font-weight: 800;">${dateStr}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 12px;">
          <th style="padding: 10px; border: 1px solid #334155; text-align: left; width: 25%;">Employee Details</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 15%;">Branch</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 22%;">Punch Information</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 15%;">Type</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 23%;">Selfie Photo Proof</th>
        </tr>
      </thead>
      <tbody>
  `;

  processLogs.forEach((l, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const typeColor = l.type === 'IN' ? '#059669' : '#dc2626';
    const typeBg = l.type === 'IN' ? '#ecfdf5' : '#fef2f2';

    const punchTimeStr = formatISTTime(l.timestamp, true);

    const photoUrl = l.photoUrlBase64 || l.photo_url || '';
    const imgTag = photoUrl && photoUrl.trim() !== ''
      ? `<img src="${photoUrl}" width="160" height="160" style="width: 160px; height: 160px; border-radius: 10px; border: 1.5px solid #cbd5e1; display: block; margin: 0 auto;" />`
      : `<div style="width: 160px; height: 160px; background: #f8fafc; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #94a3b8; border: 1px dashed #cbd5e1; font-weight: bold; margin: 0 auto;">No Photo</div>`;

    const selfieBlock = `
      <div style="text-align: center; padding: 2px;">
        ${imgTag}
        <div style="font-size: 10.5px; font-weight: 800; color: ${typeColor}; margin-top: 5px;">Type: ${l.type}</div>
        <div style="font-size: 10px; font-weight: 700; color: #1e3a8a; margin-top: 2px;">${punchTimeStr}</div>
      </div>
    `;

    html += `
      <tr style="background-color: ${bgColor}; font-size: 11px; color: #1e293b;">
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #1e293b; font-size: 12px;">${l.emp_name}</div>
          <div style="color: #64748b; font-size: 10px;">ID: ${l.emp_id}</div>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">${l.branch_name}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; line-height: 1.4;">
          <div><b>Punch Time:</b> ${punchTimeStr}</div>
          <div style="font-size: 10px; color: #64748b;">Distance: ${l.distance_m || 0}m</div>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">
          <span style="background: ${typeBg}; color: ${typeColor}; padding: 3px 8px; border-radius: 10px; font-weight: 800; font-size: 10px; border: 1px solid ${typeColor}44; display: inline-block;">
            SHIFT-${l.type}
          </span>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${selfieBlock}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center;">
      Verification Security Key: AQSA-LIVE-SELFIE-${Math.random().toString(36).substring(2, 9).toUpperCase()}
    </div>
  `;

  const canvas = await renderHtmlToCanvas(html, 1050, 1.5);
  saveCanvasToPdf(canvas, `AQSA_Live_Selfie_Report_${dateStr}.pdf`);
}
