import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AttendanceLog, DailySummaryRow } from '../types';
import { formatISTDateTime, formatISTTime } from './dateUtils';

/**
 * HELPER: Converts any image URL into a "Data URL" (Base64).
 * This is the most reliable way to ensure html2canvas "sees" the image.
 */
async function toDataURL(url: string): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  
  // If it's already a data URL, return it
  if (trimmed.startsWith('data:')) return trimmed;

  // Try fetching through the proxy first
  try {
    const res = await fetch('/api/proxy-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.dataUrl && json.dataUrl.startsWith('data:')) {
        return json.dataUrl;
      }
    }
  } catch (err) {
    console.warn('Proxy error:', err);
  }

  // Fallback: Try client-side conversion
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = trimmed;
  });
}

async function preparePhoto(url?: string): Promise<string> {
  if (!url) return '';
  return await toDataURL(url);
}

/**
 * CORE: Renders the HTML into a Canvas and then a PDF.
 * Increased wait times to ensure many photos can load.
 */
async function renderHtmlToCanvas(htmlContent: string, widthPx: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = `${widthPx}px`;
    iframe.style.height = '2000px'; 
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return reject(new Error('Iframe Error'));
    }

    doc.open();
    doc.write(`
      <html>
        <head>
          <style>
            * { box-sizing: border-box; font-family: sans-serif; }
            body { margin: 0; padding: 20px; background: white; width: ${widthPx}px; }
            img { display: block; object-fit: cover; background: #f0f0f0; }
            .punch-box { 
              display: inline-block; 
              width: 120px; 
              margin: 4px; 
              padding: 5px; 
              border: 1px solid #ddd; 
              border-radius: 4px; 
              text-align: center; 
              vertical-align: top;
              background: white;
            }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    doc.close();

    // IMPORTANT: Wait for all images to decode
    setTimeout(async () => {
      try {
        const images = Array.from(doc.images);
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(r => { img.onload = r; img.onerror = r; });
        }));

        // Give extra 2 seconds for the browser to actually paint the images
        await new Promise(r => setTimeout(r, 2000));

        const canvas = await html2canvas(doc.body, {
          scale: 1.5, // Slightly lower scale to save memory for big reports
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          width: widthPx,
          height: doc.body.scrollHeight,
        });

        document.body.removeChild(iframe);
        resolve(canvas);
      } catch (err) {
        document.body.removeChild(iframe);
        reject(err);
      }
    }, 1000); // Initial load wait
  });
}

function saveCanvasToPdf(canvas: HTMLCanvasElement, filename: string) {
  const imgData = canvas.toDataURL('image/jpeg', 0.9);
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }
  pdf.save(filename);
}

// 1. STANDARD REPORT
export async function generateFormattedPDF(data: DailySummaryRow[], dateStr: string) {
  let html = `<h2 style="color: #1e3a8a;">AQSA ATTENDANCE SUMMARY - ${dateStr}</h2>
    <table border="1" cellspacing="0" cellpadding="8" style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <tr style="background: #1e293b; color: white;">
        <th>Employee</th><th>Branch</th><th>Intervals</th><th>Hrs</th><th>Status</th>
      </tr>`;
  
  data.forEach(row => {
    const intervals = [row.in1, row.out1, row.in2, row.out2, row.in3, row.out3].filter(Boolean).join(' / ');
    html += `<tr>
      <td><b>${row.name}</b><br>ID: ${row.empId}</td>
      <td align="center">${row.branch}</td>
      <td align="center">${intervals || '-'}</td>
      <td align="center">${row.totalHours}h</td>
      <td align="center">${row.status}</td>
    </tr>`;
  });
  html += `</table>`;

  const canvas = await renderHtmlToCanvas(html, 1000);
  saveCanvasToPdf(canvas, `Summary_${dateStr}.pdf`);
}

// 2. SELFIE PROOFS REPORT (THE FIXED ONE)
export async function generateSelfiePDF(data: DailySummaryRow[], dateStr: string) {
  // Step 1: Pre-convert all images to base64 so html2canvas doesn't have to fetch them
  const processedData = await Promise.all(data.map(async row => ({
    ...row,
    p1: await preparePhoto(row.in1Photo),
    p2: await preparePhoto(row.out1Photo),
    p3: await preparePhoto(row.in2Photo),
    p4: await preparePhoto(row.out2Photo),
    p5: await preparePhoto(row.in3Photo),
    p6: await preparePhoto(row.out3Photo),
  })));

  let html = `<h2 style="color: #1e3a8a;">AQSA SELFIE VERIFICATION - ${dateStr}</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="width: 100%; border-collapse: collapse; font-size: 10px;">
      <tr style="background: #1e293b; color: white;">
        <th width="15%">Employee</th>
        <th width="75%">Selfie Proofs (Type & Time)</th>
        <th width="10%">Status</th>
      </tr>`;

  processedData.forEach(row => {
    const makeBox = (label: string, time: string, photo: string) => {
      if (!time && !photo) return '';
      // Only show image if we actually have a base64 string
      const imgHtml = photo.length > 100 
        ? `<img src="${photo}" width="110" height="110" />`
        : `<div style="width:110px; height:110px; background:#f0f0f0; border:1px dashed #ccc; padding-top:45px;">No Photo</div>`;
      
      const labelColor = label.includes('IN') ? 'green' : 'red';

      return `
        <div class="punch-box">
          ${imgHtml}
          <div style="color:${labelColor}; font-weight:bold; margin-top:4px;">${label}</div>
          <div style="font-weight:bold;">${time || '--:--'}</div>
        </div>
      `;
    };

    let boxes = '';
    boxes += makeBox('IN 1', row.in1, row.p1);
    boxes += makeBox('OUT 1', row.out1, row.p2);
    if (row.in2 || row.p3) boxes += makeBox('IN 2', row.in2, row.p3);
    if (row.out2 || row.p4) boxes += makeBox('OUT 2', row.out2, row.p4);
    if (row.in3 || row.p5) boxes += makeBox('IN 3', row.in3, row.p5);
    if (row.out3 || row.p6) boxes += makeBox('OUT 3', row.out3, row.p6);

    html += `<tr>
      <td valign="top"><b>${row.name}</b><br>ID: ${row.empId}</td>
      <td align="center">${boxes || 'No Punches'}</td>
      <td align="center" valign="top">${row.status}</td>
    </tr>`;
  });

  html += `</table>`;

  const canvas = await renderHtmlToCanvas(html, 1200);
  saveCanvasToPdf(canvas, `Selfie_Proofs_${dateStr}.pdf`);
}

// 3. LIVE LOGS REPORT
export async function generateLiveSelfiePDF(data: AttendanceLog[], dateStr: string) {
  const processedLogs = await Promise.all(data.map(async log => ({
    ...log,
    base64: await preparePhoto(log.photo_url)
  })));

  let html = `<h2 style="color: #1e3a8a;">AQSA LIVE LOGS - ${dateStr}</h2>
    <table border="1" cellspacing="0" cellpadding="10" style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <tr style="background: #1e293b; color: white;">
        <th>Employee</th><th>Type & Time</th><th>Photo Proof</th>
      </tr>`;

  processedLogs.forEach(log => {
    const imgHtml = log.base64.length > 100 
      ? `<img src="${log.base64}" width="140" height="140" />`
      : `<div style="width:140px; height:140px; background:#eee; padding-top:60px;">No Photo</div>`;

    html += `<tr>
      <td align="center"><b>${log.emp_name}</b><br>ID: ${log.emp_id}</td>
      <td align="center"><b>${log.type}</b><br>${formatISTTime(log.timestamp, true)}</td>
      <td align="center">${imgHtml}</td>
    </tr>`;
  });

  html += `</table>`;
  const canvas = await renderHtmlToCanvas(html, 1000);
  saveCanvasToPdf(canvas, `Live_Logs_${dateStr}.pdf`);
}