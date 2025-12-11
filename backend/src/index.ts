import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';

// Cargar variables de entorno
dotenv.config();

// Importar rutas
import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import interestsRoutes from './routes/interestsRoutes';
import swipeRoutes from './routes/swipeRoutes';
import chatRoutes from './routes/chatRoutes';
import mediaRoutes from './routes/mediaRoutes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const httpServer = createServer(app);

// Configurar CORS - Permitir conexiones desde cualquier origen en desarrollo
const corsOrigin = process.env.CORS_ORIGIN || '*';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Configurar Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: isDevelopment ? '*' : corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middlewares básicos
app.use(helmet({
  // Deshabilitar algunas restricciones de Helmet en desarrollo para facilitar conexiones móviles
  contentSecurityPolicy: isDevelopment ? false : undefined,
}));
app.use(cors({
  origin: isDevelopment ? '*' : corsOrigin,
  credentials: true,
}));

// Middleware para parsear JSON y URL-encoded, pero NO multipart/form-data
// Multer manejará multipart/form-data en sus propias rutas
app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // No parsear si es multipart/form-data (Multer lo hará)
    return next();
  }
  // Parsear JSON y URL-encoded para otras rutas
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});

// Ruta de prueba
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PanaMatch API is running' });
});

// Servir archivos estáticos (solo si NO estamos usando GCS)
// Si usamos GCS, las imágenes se sirven directamente desde Google Cloud Storage
import { storageService } from './services/storageService';

let uploadsPath: string | undefined;

if (!storageService.isUsingGCS()) {
  uploadsPath = process.env.IMAGE_STORAGE_PATH || path.join(__dirname, '../uploads');
  console.log('📁 Ruta de uploads configurada:', uploadsPath);
  console.log('📁 Ruta absoluta de uploads:', path.resolve(uploadsPath));

  // Verificar que la carpeta existe
  if (!fs.existsSync(uploadsPath)) {
    console.warn('⚠️  La carpeta uploads no existe, creándola...');
    fs.mkdirSync(uploadsPath, { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, 'avatars'), { recursive: true });
    fs.mkdirSync(path.join(uploadsPath, 'messages'), { recursive: true });
  }

  app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res) => {
      // Permitir acceso desde cualquier origen para desarrollo
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache de 1 año
    }
  }));
} else {
  console.log('☁️  Usando Google Cloud Storage - archivos estáticos se sirven desde GCS');
}

// Endpoint de prueba para verificar archivos (solo si no usamos GCS)
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

// Rutas de la API
app.use('/auth', authRoutes);
app.use('/users', profileRoutes);
app.use('/interests', interestsRoutes);
app.use('/swipe', swipeRoutes);
app.use('/chats', chatRoutes);
app.use('/media', mediaRoutes);

// Configurar Socket.IO handlers
import { setupSocketIO } from './socket/socketHandler';
setupSocketIO(io);

// Iniciar servidor - Escuchar en todas las interfaces (0.0.0.0) para permitir conexiones desde la red local
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`WebSocket servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  if (isDevelopment) {
    console.log(`CORS habilitado para desarrollo`);
  }
});

export { app, io };

