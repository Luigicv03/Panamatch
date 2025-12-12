import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';

class StorageService {
  private gcs: Storage | null = null;
  private bucketName: string | null = null;
  private useGCS: boolean;

  constructor() {
 
    this.useGCS = !!(
      process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_CLOUD_BUCKET_NAME &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
       process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
       process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64)
    );

    if (this.useGCS) {
      try {
        let credentials: any = undefined;

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
          try {
            credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
          } catch (parseError) {
            console.error('Error al parsear GOOGLE_APPLICATION_CREDENTIALS_JSON:', parseError);
          }
        }

        if (!credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
          try {
            const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf8');
            credentials = JSON.parse(decoded);
          } catch (decodeError) {
            console.error('Error al decodificar GOOGLE_APPLICATION_CREDENTIALS_BASE64:', decodeError);
          }
        }

        if (!credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
            try {
              credentials = JSON.parse(
                fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
              );
            } catch (fileError) {
              console.error('Error al leer archivo de credenciales:', fileError);
            }
          } else {
            try {
              credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            } catch (jsonError) {
              console.warn('GOOGLE_APPLICATION_CREDENTIALS no es válido');
            }
          }
        }

        if (!credentials) {
          throw new Error('No se pudieron cargar las credenciales de Google Cloud');
        }

        this.gcs = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: credentials,
        });
        this.bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME!;
      } catch (error) {
        console.error('Error al inicializar Google Cloud Storage:', error);
        this.useGCS = false;
      }
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    type: 'avatar' | 'message'
  ): Promise<string> {
    if (this.useGCS && this.gcs && this.bucketName) {
      return this.uploadToGCS(fileBuffer, filename, type);
    } else {
      return this.uploadToLocal(fileBuffer, filename, type);
    }
  }

  private async uploadToGCS(
    fileBuffer: Buffer,
    filename: string,
    type: 'avatar' | 'message'
  ): Promise<string> {
    if (!this.gcs || !this.bucketName) {
      throw new Error('Google Cloud Storage no está configurado');
    }

    const bucket = this.gcs.bucket(this.bucketName);
    const subDir = type === 'message' ? 'messages' : 'avatars';
    const filePath = `${subDir}/${filename}`;
    const file = bucket.file(filePath);

    const stream = file.createWriteStream({
      metadata: {
        contentType: this.getContentType(filename),
        cacheControl: 'public, max-age=31536000',
      },
      public: true,
    });

    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        console.error('Error al subir a GCS:', error);
        reject(error);
      });

      stream.on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
        resolve(publicUrl);
      });

      stream.end(fileBuffer);
    });
  }

  private async uploadToLocal(
    fileBuffer: Buffer,
    filename: string,
    type: 'avatar' | 'message'
  ): Promise<string> {
    const uploadPath = process.env.IMAGE_STORAGE_PATH || './uploads';
    const absoluteUploadPath = path.resolve(uploadPath);
    const subDir = type === 'message' ? 'messages' : 'avatars';
    const fullPath = path.join(absoluteUploadPath, subDir, filename);

    // Crear directorio si no existe
    const dirPath = path.dirname(fullPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Escribir archivo
    fs.writeFileSync(fullPath, fileBuffer);

    return `/uploads/${subDir}/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (this.useGCS && this.gcs && this.bucketName) {
      const urlPattern = new RegExp(`https://storage\\.googleapis\\.com/${this.bucketName}/(.+)`);
      const match = fileUrl.match(urlPattern);
      
      if (match && match[1]) {
        const filePath = match[1];
        const bucket = this.gcs.bucket(this.bucketName);
        const file = bucket.file(filePath);
        
        try {
          await file.delete();
      } catch (error: any) {
        console.error('Error al eliminar archivo de GCS:', error);
      }
      }
    } else {
      try {
        const absolutePath = fileUrl.startsWith('/uploads/')
          ? path.resolve(process.env.IMAGE_STORAGE_PATH || './uploads', fileUrl.replace('/uploads/', ''))
          : fileUrl;
        
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (error) {
        console.error('Error al eliminar archivo local:', error);
      }
    }
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return contentTypes[ext] || 'image/jpeg';
  }

  isUsingGCS(): boolean {
    return this.useGCS;
  }
}

export const storageService = new StorageService();

