import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AttendanceLog, DailySummaryRow } from '../types';

// Helper to convert images to base64 data URLs for clean canvas rendering
async function toDataURL(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return '';
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return '';
  }
}

// Render HTML content safely inside an off-screen iframe to avoid Tailwind v4 oklch CSS conflicts and opacity issues
async function renderHtmlToCanvas(htmlContent: string, widthPx: number, scale = 2): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = `${widthPx}px`;
    iframe.style.height = '1000px';
    iframe.style.border = 'none';
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
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    doc.close();

    setTimeout(async () => {
      try {
        const body = doc.body;
        const fullHeight = Math.max(body.scrollHeight, body.offsetHeight, 600);
        iframe.style.height = `${fullHeight}px`;

        const canvas = await html2canvas(body, {
          scale,
          useCORS: true,
          allowTaint: true,
          width: widthPx,
          height: fullHeight,
          windowWidth: widthPx,
          windowHeight: fullHeight,
          backgroundColor: '#ffffff',
        });

        document.body.removeChild(iframe);
        resolve(canvas);
      } catch (err) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        reject(err);
      }
    }, 200);
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
      <strong>Generated:</strong> ${new Date().toLocaleString()}
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

// 2. Generate PDF with Selfie Proofs (Matching GAS downloadFilteredPDFWithSelfies)
export async function generateSelfiePDF(data: DailySummaryRow[], dateStr: string) {
  // Pre-convert images
  const processRows = await Promise.all(
    data.map(async (row) => ({
      ...row,
      in1Photo: row.in1Photo ? await toDataURL(row.in1Photo) : '',
      out1Photo: row.out1Photo ? await toDataURL(row.out1Photo) : '',
      in2Photo: row.in2Photo ? await toDataURL(row.in2Photo) : '',
      out2Photo: row.out2Photo ? await toDataURL(row.out2Photo) : '',
    }))
  );

  let html = `
    <div style="border-bottom: 4px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 800;">AQSA ATTENDANCE & VERIFICATION REPORT</h1>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">Daily Summary with Selfie Proofs</p>
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
          <th style="padding: 10px; border: 1px solid #334155; text-align: left; width: 22%;">Employee Details</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 12%;">Branch</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 42%;">Shift Punches & Selfie Proofs</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 8%;">Hours</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 8%;">OT</th>
          <th style="padding: 10px; border: 1px solid #334155; text-align: center; width: 8%;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  processRows.forEach((row, index) => {
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

    const makePunchBox = (label: string, time: string, photoUrl: string) => {
      if (!time && !photoUrl) return '';
      const imgTag = photoUrl
        ? `<img src="${photoUrl}" style="width: 65px; height: 65px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />`
        : `<div style="width: 65px; height: 65px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; border: 1px solid #cbd5e1; font-weight: bold; margin: 0 auto;">No Photo</div>`;

      const isIN = label.includes('IN');
      const typeColor = isIN ? '#059669' : '#dc2626';

      return `
        <div style="text-align: center; border: 1px solid #cbd5e1; border-radius: 8px; padding: 5px; background: #ffffff; min-width: 80px; display: inline-block; margin: 2px; vertical-align: top;">
          ${imgTag}
          <div style="font-size: 10px; font-weight: 800; color: ${typeColor}; margin-top: 4px;">Type: ${label}</div>
          <div style="font-size: 9.5px; font-weight: 700; color: #1e3a8a; margin-top: 2px;">${time || '--:--'}</div>
        </div>
      `;
    };

    let punchesHtml = '';
    if (row.status === 'Absent') {
      punchesHtml = `<span style="color: #cbd5e1; font-style: italic; font-size: 11px;">Employee Absent</span>`;
    } else {
      punchesHtml += makePunchBox('IN 1', row.in1, row.in1Photo);
      punchesHtml += makePunchBox('OUT 1', row.out1, row.out1Photo);
      if (row.in2 || row.out2Photo) punchesHtml += makePunchBox('IN 2', row.in2, row.in2Photo);
      if (row.out2 || row.out2Photo) punchesHtml += makePunchBox('OUT 2', row.out2, row.out2Photo);
    }

    html += `
      <tr style="background-color: ${bgColor}; font-size: 11px; color: #1e293b;">
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 800; color: #1e293b; font-size: 12px;">${row.name}</div>
          <div style="color: #64748b; font-size: 10px;">ID: ${row.empId}</div>
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">${row.branch}</td>
        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${punchesHtml}</td>
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
      Verification Security Key: AQSA-SELFIE-${Math.random().toString(36).substring(2, 9).toUpperCase()}
    </div>
  `;

  const canvas = await renderHtmlToCanvas(html, 1100, 1.5);
  saveCanvasToPdf(canvas, `AQSA_Verification_Selfie_Report_${dateStr}.pdf`);
}

// 3. Generate Live Punch Verification PDF with Selfies (Matching GAS downloadFilteredLivePDFWithSelfies)
export async function generateLiveSelfiePDF(data: AttendanceLog[], dateStr: string) {
  const processLogs = await Promise.all(
    data.map(async (l) => ({
      ...l,
      photoUrlBase64: l.photo_url ? await toDataURL(l.photo_url) : '',
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

    const punchTimeStr = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const imgTag = l.photoUrlBase64
      ? `<img src="${l.photoUrlBase64}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 8px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />`
      : `<div style="width: 75px; height: 75px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #94a3b8; border: 1px solid #cbd5e1; font-weight: bold; margin: 0 auto;">No Photo</div>`;

    const selfieBlock = `
      <div style="text-align: center; padding: 2px;">
        ${imgTag}
        <div style="font-size: 10px; font-weight: 800; color: ${typeColor}; margin-top: 4px;">Type: ${l.type}</div>
        <div style="font-size: 9.5px; font-weight: 700; color: #1e3a8a; margin-top: 1px;">${punchTimeStr}</div>
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
