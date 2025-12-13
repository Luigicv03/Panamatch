import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';

dotenv.config();

if (process.env.RUN_MIGRATIONS_ON_START === 'true' && process.env.NODE_ENV === 'production') {
  import('./utils/runMigrations').then(async ({ runMigrations, runSeed }) => {
    await runMigrations();
    if (process.env.RUN_SEED_ON_START === 'true') {
      await runSeed();
    }
  }).catch(console.error);
}

import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import interestsRoutes from './routes/interestsRoutes';
import swipeRoutes from './routes/swipeRoutes';
import chatRoutes from './routes/chatRoutes';
import mediaRoutes from './routes/mediaRoutes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const httpServer = createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || '*';
const isDevelopment = process.env.NODE_ENV !== 'production';

const io = new Server(httpServer, {
  cors: {
    origin: isDevelopment ? '*' : corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : undefined,
}));
app.use(cors({
  origin: isDevelopment ? '*' : corsOrigin,
  credentials: true,
}));

app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PanaMatch API is running' });
});

import { storageService } from './services/storageService';

app.get('/test-gcs', (req, res) => {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  const isFile = creds && fs.existsSync(creds);
  
  res.json({
    isUsingGCS: storageService.isUsingGCS(),
    hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    hasBucketName: !!process.env.GOOGLE_CLOUD_BUCKET_NAME,
    hasCredentialsJSON: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    hasCredentialsBase64: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64,
    hasCredentialsFile: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME,
    credentialsJSONLength: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0,
    credentialsFileLength: creds.length,
    credentialsFileIsActualFile: isFile,
    credentialsLoaded: storageService.isUsingGCS(),
  });
});

let uploadsPath: string | undefined;

if (!storageService.isUsingGCS()) {
  uploadsPath = process.env.IMAGE_STORAGE_PATH || path.join(__dirname, '../uploads');

  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, 'avatars'), { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, 'messages'), { recursive: true });
  }

  app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Cache-Control', 'public, max-age=31536000');
    }
  }));
}

app.get('/test-uploads', (req, res) => {
  if (!uploadsPath) {
    return res.json({ message: 'Usando Google Cloud Storage - este endpoint no está disponible' });
  }
  
  const avatarsPath = path.join(uploadsPath, 'avatars');
  const messagesPath = path.join(uploadsPath, 'messages');
  
  const avatars = fs.existsSync(avatarsPath) ? fs.readdirSync(avatarsPath) : [];
  const messages = fs.existsSync(messagesPath) ? fs.readdirSync(messagesPath) : [];
  
  res.json({
    uploadsPath,
    absolutePath: path.resolve(uploadsPath),
    exists: fs.existsSync(uploadsPath),
    avatars: {
      path: avatarsPath,
      exists: fs.existsSync(avatarsPath),
      count: avatars.length,
      files: avatars.slice(0, 5),
    },
    messages: {
      path: messagesPath,
      exists: fs.existsSync(messagesPath),
      count: messages.length,
      files: messages.slice(0, 5),
    },
  });
});

app.use('/auth', authRoutes);
app.use('/users', profileRoutes);
app.use('/interests', interestsRoutes);
app.use('/swipe', swipeRoutes);
app.use('/chats', chatRoutes);
app.use('/media', mediaRoutes);

import { setupSocketIO } from './socket/socketHandler';
setupSocketIO(io);

const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`WebSocket servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

export { app, io };

