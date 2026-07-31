import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AttendanceLog, DailySummaryRow } from '../types';
import { formatISTDateTime, formatISTTime } from './dateUtils';

// Helper to convert images to base64 data URLs for clean canvas rendering
async function toDataURL(url: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/9j/')) return `data:image/jpeg;base64,${trimmed}`;
  if (trimmed.startsWith('iVBORw0KG')) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith('R0lGOD')) return `data:image/gif;base64,${trimmed}`;
  if (trimmed.startsWith('UklGR')) return `data:image/webp;base64,${trimmed}`;

  try {
    const res = await fetch('/api/proxy-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
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
      resolve('');
    };
    img.onerror = () => resolve('');
    img.src = trimmed;
  });
}

async function preparePhoto(url?: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  const dataUrl = await toDataURL(trimmed);
  return dataUrl || trimmed;
}

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
            img { display: block; margin: 0 auto; max-width: 100%; object-fit: cover; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    doc.close();

    setTimeout(async () => {
      try {
        const body = doc.body;
        body.getBoundingClientRect();
        const images = Array.from(doc.images);
        await Promise.all(
          images.map(async (img) => {
            try { if (img.decode) await img.decode(); } catch (e) {}
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((res) => {
              let done = false;
              const finish = () => { if (!done) { done = true; res(null); } };
              img.onload = finish;
              img.onerror = finish;
              setTimeout(finish, 5000);
            });
          })
        );

        await new Promise((res) => setTimeout(res, 800));

        const fullHeight = Math.max(body.scrollHeight, body.offsetHeight, 600);
        iframe.style.height = `${fullHeight}px`;

        const canvas = await html2canvas(body, {
          scale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          width: widthPx,
          height: fullHeight,
          windowWidth: widthPx,
          windowHeight: fullHeight,
          backgroundColor: '#ffffff',
          imageTimeout: 20000,
        });

        document.body.removeChild(iframe);
        resolve(canvas);
      } catch (err) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        reject(err);
      }
    }, 500);
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

// 1. Standard PDF
export async function generateFormattedPDF(data: DailySummaryRow[], dateStr: string) {
  let html = `
    <div style="border-bottom: 4px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 24px; font-weight: 800;">AQSA ATTENDANCE REPORT</h1>
          </td>
          <td align="right">
            <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
              <span style="font-size: 16px; color: #1e3a8a; font-weight: 800;">${dateStr}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 12px;">
          <th style="padding: 10px; border: 1px solid #334155;">Employee</th>
          <th style="padding: 10px; border: 1px solid #334155;">Branch</th>
          <th style="padding: 10px; border: 1px solid #334155;">Work Intervals</th>
          <th style="padding: 10px; border: 1px solid #334155;">Hrs</th>
          <th style="padding: 10px; border: 1px solid #334155;">OT</th>
          <th style="padding: 10px; border: 1px solid #334155;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const intervals = [];
    if (row.in1 || row.out1) intervals.push(`${row.in1 || '-'} / ${row.out1 || '-'}`);
    if (row.in2 || row.out2) intervals.push(`${row.in2 || '-'} / ${row.out2 || '-'}`);
    if (row.in3 || row.out3) intervals.push(`${row.in3 || '-'} / ${row.out3 || '-'}`);
    if (row.in4 || row.out4) intervals.push(`${row.in4 || '-'} / ${row.out4 || '-'}`);
    if (row.in5 || row.out5) intervals.push(`${row.in5 || '-'} / ${row.out5 || '-'}`);

    html += `
      <tr style="background-color: ${bgColor}; font-size: 11px;">
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><b>${row.name}</b><br>ID: ${row.empId}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${row.branch}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${intervals.join('<br>')}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${row.totalHours}h</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${row.ot}h</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${row.status}</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;

  const canvas = await renderHtmlToCanvas(html, 1050, 2);
  saveCanvasToPdf(canvas, `AQSA_Summary_${dateStr}.pdf`);
}

// 2. Selfie Proofs PDF (FIXED SECTION)
export async function generateSelfiePDF(data: DailySummaryRow[], dateStr: string) {
  const processRows = await Promise.all(
    data.map(async (row) => ({
      ...row,
      in1Photo: await preparePhoto(row.in1Photo),
      out1Photo: await preparePhoto(row.out1Photo),
      in2Photo: await preparePhoto(row.in2Photo),
      out2Photo: await preparePhoto(row.out2Photo),
      in3Photo: await preparePhoto(row.in3Photo),
      out3Photo: await preparePhoto(row.out3Photo),
      in4Photo: await preparePhoto(row.in4Photo),
      out4Photo: await preparePhoto(row.out4Photo),
      in5Photo: await preparePhoto(row.in5Photo),
      out5Photo: await preparePhoto(row.out5Photo),
    }))
  );

  let html = `
    <h1 style="color: #1e3a8a; border-bottom: 4px solid #1e3a8a; padding-bottom: 10px;">AQSA VERIFICATION REPORT - ${dateStr}</h1>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 12px;">
          <th style="padding: 10px; border: 1px solid #334155; width: 15%;">Employee</th>
          <th style="padding: 10px; border: 1px solid #334155; width: 65%;">Selfie Proofs</th>
          <th style="padding: 10px; border: 1px solid #334155; width: 10%;">Hrs</th>
          <th style="padding: 10px; border: 1px solid #334155; width: 10%;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  processRows.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    const makeBox = (label: string, time: string, photo?: string) => {
      if (!time && !photo) return '';
      const isIN = label.includes('IN');
      const color = isIN ? '#059669' : '#dc2626';
      const img = photo && photo.length > 50 
        ? `<img src="${photo}" style="width: 110px; height: 110px; border-radius: 5px; border: 1px solid #ccc; display: block;" />`
        : `<div style="width: 110px; height: 110px; background: #eee; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 10px;">No Photo</div>`;
      
      return `
        <div style="display: inline-block; margin: 5px; padding: 5px; border: 1px solid #e2e8f0; background: white; text-align: center; vertical-align: top;">
          ${img}
          <div style="font-size: 10px; font-weight: bold; color: ${color}; margin-top: 3px;">${label}</div>
          <div style="font-size: 10px; font-weight: bold;">${time || '--:--'}</div>
        </div>
      `;
    };

    let proofs = makeBox('IN 1', row.in1, row.in1Photo) + makeBox('OUT 1', row.out1, row.out1Photo) +
                 makeBox('IN 2', row.in2, row.in2Photo) + makeBox('OUT 2', row.out2, row.out2Photo) +
                 makeBox('IN 3', row.in3, row.in3Photo) + makeBox('OUT 3', row.out3, row.out3Photo) +
                 makeBox('IN 4', row.in4, row.in4Photo) + makeBox('OUT 4', row.out4, row.out4Photo) +
                 makeBox('IN 5', row.in5, row.in5Photo) + makeBox('OUT 5', row.out5, row.out5Photo);

    html += `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 10px; border: 1px solid #e2e8f0; vertical-align: top;"><b>${row.name}</b><br>ID: ${row.empId}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${proofs || 'No records'}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; vertical-align: top;"><b>${row.totalHours}h</b></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; vertical-align: top;">${row.status}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  const canvas = await renderHtmlToCanvas(html, 1150, 1.5);
  saveCanvasToPdf(canvas, `AQSA_Selfie_Report_${dateStr}.pdf`);
}

// 3. Live Punch PDF
export async function generateLiveSelfiePDF(data: AttendanceLog[], dateStr: string) {
  const processLogs = await Promise.all(
    data.map(async (l) => ({
      ...l,
      photoUrlBase64: await preparePhoto(l.photo_url),
    }))
  );

  let html = `
    <h1 style="color: #1e3a8a; border-bottom: 4px solid #1e3a8a; padding-bottom: 10px;">AQSA LIVE LOGS - ${dateStr}</h1>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff; font-size: 12px;">
          <th style="padding: 10px; border: 1px solid #334155;">Employee</th>
          <th style="padding: 10px; border: 1px solid #334155;">Time & Type</th>
          <th style="padding: 10px; border: 1px solid #334155;">Selfie Proof</th>
        </tr>
      </thead>
      <tbody>
  `;

  processLogs.forEach((l, index) => {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const photo = l.photoUrlBase64 || '';
    const img = photo.length > 50 
      ? `<img src="${photo}" style="width: 150px; height: 150px; border-radius: 8px; border: 1px solid #ccc; display: block; margin: 0 auto;" />`
      : `<div style="width: 150px; height: 150px; background: #eee; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; margin: 0 auto;">No Photo</div>`;

    html += `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;"><b>${l.emp_name}</b><br>ID: ${l.emp_id}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
          <b>${l.type}</b><br>${formatISTTime(l.timestamp, true)}
        </td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${img}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  const canvas = await renderHtmlToCanvas(html, 1050, 1.5);
  saveCanvasToPdf(canvas, `AQSA_Live_Selfie_${dateStr}.pdf`);
}