import express from 'express';
import path from 'path';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Increase JSON payload limit to handle base64 selfie images
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Helper to get Google Drive client using OAuth access token
function getDriveClient(req: express.Request) {
  let token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

  const authHeader = req.headers['authorization'] || req.headers['x-goog-authenticated-user-token'];
  if (authHeader && typeof authHeader === 'string') {
    token = authHeader.replace(/^Bearer\s+/i, '');
  }

  if (!token) {
    throw new Error('Google OAuth Access Token not found. Please ensure OAuth flow is completed.');
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  return google.drive({ version: 'v3', auth });
}

const SPECIFIC_FOLDER_ID = '1Ql8Xl-uyjQ_v5ibU2fzy8bCsMYk37XWw';
const SPECIFIC_FOLDER_URL = `https://drive.google.com/drive/folders/${SPECIFIC_FOLDER_ID}`;

// API Route: Check Drive Integration Status & Get Folder Link
app.get('/api/drive-status', async (req, res) => {
  try {
    const drive = getDriveClient(req);
    const about = await drive.about.get({ fields: 'user' });
    
    res.json({
      connected: true,
      user: about.data.user,
      folderId: SPECIFIC_FOLDER_ID,
      folderUrl: SPECIFIC_FOLDER_URL,
      folderName: 'AQSA Attendance Selfies',
    });
  } catch (err: any) {
    console.error('Drive status error:', err);
    res.json({
      connected: false,
      folderId: SPECIFIC_FOLDER_ID,
      folderUrl: SPECIFIC_FOLDER_URL,
      error: err.message || 'Google Drive not connected',
    });
  }
});

// API Route: Get Folder Link and files
app.get('/api/drive-folder', async (req, res) => {
  try {
    const drive = getDriveClient(req);

    // List recent files in folder
    const filesList = await drive.files.list({
      q: `'${SPECIFIC_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, createdTime)',
      pageSize: 20,
      orderBy: 'createdTime desc',
    });

    res.json({
      success: true,
      folderId: SPECIFIC_FOLDER_ID,
      folderUrl: SPECIFIC_FOLDER_URL,
      folderName: 'AQSA Attendance Selfies',
      files: filesList.data.files || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Upload Selfie Image to Google Drive
app.post('/api/upload-selfie', async (req, res) => {
  try {
    const { imageBase64, fileName, empId, empName } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 photo is required' });
    }

    const drive = getDriveClient(req);

    // Clean base64 string
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const stream = Readable.from(buffer);

    const actualFileName = fileName || `${empId || 'EMP'}_${Date.now()}.jpg`;

    const fileMetadata: any = {
      name: actualFileName,
      mimeType: 'image/jpeg',
      description: `Attendance selfie proof for ${empName || 'Employee'} (${empId || 'N/A'}) captured on ${new Date().toISOString()}`,
      parents: [SPECIFIC_FOLDER_ID],
    };

    const media = {
      mimeType: 'image/jpeg',
      body: stream,
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = file.data.id;

    if (!fileId) {
      throw new Error('Failed to obtain Google Drive file ID');
    }

    // Grant read permission to anyone with link
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permErr) {
      console.warn('Could not set public permissions on Drive file:', permErr);
    }

    // Format matching Google Apps Script Drive link format
    const driveUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;

    return res.json({
      success: true,
      fileId: fileId,
      driveUrl: driveUrl,
      webViewLink: file.data.webViewLink || driveUrl,
    });
  } catch (err: any) {
    console.error('Google Drive Selfie Upload Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to upload selfie to Google Drive',
    });
  }
});

async function startServer() {
  // Vite middleware for dev or static serving for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
