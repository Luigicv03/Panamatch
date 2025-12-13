import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadPath = process.env.IMAGE_STORAGE_PATH || './uploads';
      const absoluteUploadPath = path.resolve(uploadPath);
      
      if (!fs.existsSync(absoluteUploadPath)) {
        fs.mkdirSync(absoluteUploadPath, { recursive: true });
      }
      if (!fs.existsSync(path.join(absoluteUploadPath, 'avatars'))) {
        fs.mkdirSync(path.join(absoluteUploadPath, 'avatars'), { recursive: true });
      }
      if (!fs.existsSync(path.join(absoluteUploadPath, 'messages'))) {
        fs.mkdirSync(path.join(absoluteUploadPath, 'messages'), { recursive: true });
      }

      const subDir = 'messages';
      const fullPath = path.join(absoluteUploadPath, subDir);
      
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      
      cb(null, fullPath);
    } catch (error) {
      console.error('Error en destination callback:', error);
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname) || '.jpg';
      const filename = `${uniqueSuffix}${ext}`;
      cb(null, filename);
    } catch (error) {
      console.error('Error en filename callback:', error);
      cb(error as Error, '');
    }
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  const extname = allowedTypes.test(ext);
  
  const mimetypeValid = file.mimetype.startsWith('image/') && 
    (file.mimetype.includes('jpeg') || 
     file.mimetype.includes('jpg') || 
     file.mimetype.includes('png') || 
     file.mimetype.includes('gif') || 
     file.mimetype.includes('webp'));

  if (mimetypeValid && extname) {
    return cb(null, true);
  } else {
    const errorMsg = `Archivo rechazado. Solo se permiten imágenes (jpeg, jpg, png, gif, webp)`;
    cb(new Error(errorMsg));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

export const getImageUrl = (filename: string, type: 'avatar' | 'message', req?: any): string => {
  const subDir = type === 'message' ? 'messages' : 'avatars';
  return `/uploads/${subDir}/${filename}`;
};

