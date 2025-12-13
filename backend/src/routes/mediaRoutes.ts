import { Router } from 'express';
import multer from 'multer';
import { upload, getImageUrl } from '../utils/upload';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { RequestWithUser } from '../types';
import path from 'path';
import fs from 'fs';
import { storageService } from '../services/storageService';

const router = Router();
const prisma = new PrismaClient();

const parseFormDataFields = (req: any, res: any, next: any) => {
  if (req.headers['content-type']?.includes('multipart/form-data') && !req.body) {
    return next();
  }
  next();
};

router.post('/upload', authMiddleware, parseFormDataFields, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 5MB' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
    }
    next();
  });
}, async (req: RequestWithUser, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const type = req.body.type || 'profile';
    const filename = req.file.filename;

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    if (!req.file.path) {
      return res.status(500).json({ 
        error: 'Error al procesar el archivo',
        details: 'req.file.path no está disponible'
      });
    }

    const multerFilePath = req.file.path;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!fs.existsSync(multerFilePath)) {
      return res.status(500).json({ 
        error: 'Error al guardar el archivo en el servidor'
      });
    }

    const fileBuffer = fs.readFileSync(multerFilePath);
    const imageType = type === 'message' ? 'message' : 'avatar';
    let imageUrl: string;
    
    try {
      imageUrl = await storageService.uploadFile(fileBuffer, filename, imageType);
      
      if (!storageService.isUsingGCS()) {
        try {
          fs.unlinkSync(multerFilePath);
        } catch (unlinkError) {
        }
      }
    } catch (uploadError: any) {
      console.error('Error al subir archivo:', uploadError);
      try {
        if (fs.existsSync(multerFilePath)) {
          fs.unlinkSync(multerFilePath);
        }
      } catch (unlinkError) {
      }
      return res.status(500).json({ 
        error: 'Error al subir el archivo',
        details: uploadError.message || 'Error desconocido'
      });
    }

    const media = await prisma.media.create({
      data: {
        profileId: type === 'profile' ? profile.id : undefined,
        url: imageUrl,
        type: type as 'profile' | 'message',
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    if (type === 'profile') {
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          avatarUrl: media.url,
        },
      });
    }

    if (!res.headersSent) {
      res.status(200).json({
        id: media.id,
        url: media.url,
        type: media.type,
      });
    }
  } catch (error: any) {
    console.error('Error al subir imagen:', error);
    
    if (error.code) {
      return res.status(400).json({ 
        error: error.message || 'Error al subir imagen',
        code: error.code,
      });
    }
    
    res.status(500).json({ error: error.message || 'Error al subir imagen' });
  }
});

router.get('/:subDir/:filename', (req, res) => {
  const { subDir, filename } = req.params;
  const uploadPath = process.env.IMAGE_STORAGE_PATH || './uploads';
  const filePath = path.join(uploadPath, subDir, filename);
  
  res.sendFile(path.resolve(filePath), (err) => {
    if (err) {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  });
});

export default router;

