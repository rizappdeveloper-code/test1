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

// Find or create "AQSA Attendance Selfies" folder in Google Drive
async function getOrCreateSelfiesFolder(drive: ReturnType<typeof google.drive>) {
  try {
    const res = await drive.files.list({
      q: "name = 'AQSA Attendance Selfies' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id!;
    }

    // Create folder
    const folderMetadata = {
      name: 'AQSA Attendance Selfies',
      mimeType: 'application/vnd.google-apps.folder',
    };
    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });
    return folder.data.id!;
  } catch (err) {
    console.warn('Could not create/find AQSA folder in Google Drive, uploading to root:', err);
    return null;
  }
}

// API Route: Check Drive Integration Status & Get Folder Link
app.get('/api/drive-status', async (req, res) => {
  const fallbackSearchUrl = 'https://drive.google.com/drive/search?q=AQSA%20Attendance%20Selfies';
  try {
    const drive = getDriveClient(req);
    const about = await drive.about.get({ fields: 'user' });
    
    let folderId = null;
    let folderUrl = fallbackSearchUrl;
    try {
      folderId = await getOrCreateSelfiesFolder(drive);
      if (folderId) {
        folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      }
    } catch (e) {
      console.warn('Could not fetch folder link:', e);
    }

    res.json({
      connected: true,
      user: about.data.user,
      folderId,
      folderUrl,
      folderName: 'AQSA Attendance Selfies',
    });
  } catch (err: any) {
    res.json({
      connected: false,
      folderUrl: fallbackSearchUrl,
      error: err.message || 'Google Drive not connected',
    });
  }
});

// API Route: Get Folder Link and files
app.get('/api/drive-folder', async (req, res) => {
  try {
    const drive = getDriveClient(req);
    const folderId = await getOrCreateSelfiesFolder(drive);
    
    if (!folderId) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    // List recent files in folder
    const filesList = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, createdTime)',
      pageSize: 20,
      orderBy: 'createdTime desc',
    });

    res.json({
      success: true,
      folderId,
      folderUrl,
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

    const folderId = await getOrCreateSelfiesFolder(drive);

    const actualFileName = fileName || `${empId || 'EMP'}_${Date.now()}.jpg`;

    const fileMetadata: any = {
      name: actualFileName,
      mimeType: 'image/jpeg',
      description: `Attendance selfie proof for ${empName || 'Employee'} (${empId || 'N/A'}) captured on ${new Date().toISOString()}`,
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

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
