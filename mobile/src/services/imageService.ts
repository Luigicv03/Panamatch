import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { config } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UploadImageResponse {
  id: string;
  url: string;
  type: 'profile' | 'message';
}

class ImageService {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    return cameraStatus === 'granted' && libraryStatus === 'granted';
  }

  async pickImageFromLibrary(): Promise<string | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Se necesitan permisos para acceder a la galería');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    return result.assets[0].uri;
  }

  async takePhoto(): Promise<string | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Se necesitan permisos para acceder a la cámara');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    return result.assets[0].uri;
  }

  async uploadImage(
    imageUri: string,
    type: 'profile' | 'message' = 'profile'
  ): Promise<UploadImageResponse> {
    // Obtener token de autenticación PRIMERO
    const token = await AsyncStorage.getItem(config.tokenStorageKey);
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    // Preparar FormData
    const formData = new FormData();
    
    // Obtener nombre de archivo de la URI
    let filename = imageUri.split('/').pop() || 'image.jpg';
    
    // Limpiar filename (puede tener caracteres especiales)
    filename = filename.split('?')[0]; // Remover query params si existen
    
    // Si no tiene extensión, agregar .jpg
    if (!filename.includes('.')) {
      filename = `${filename}.jpg`;
    }

    // Normalizar mimeType según extensión
    let mimeType = 'image/jpeg';
    const match = /\.(\w+)$/.exec(filename.toLowerCase());
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
    }

    // Usar URI tal como viene de Expo (ya tiene el formato correcto)
    const fileUri = imageUri;

    console.log('Preparing upload:', {
      filename,
      mimeType,
      uri: fileUri.substring(0, 60) + '...',
      type,
      platform: Platform.OS,
      apiUrl: config.apiUrl,
    });

    // Formato CORRECTO para React Native FormData
    // FormData en React Native requiere este formato exacto
    formData.append('image', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);
    
    formData.append('type', type);

    console.log('FormData prepared, sending request...');
    console.log('Upload URL:', `${config.apiUrl}/media/upload`);
    console.log('Full URL details:', {
      protocol: 'http',
      host: config.apiUrl.split('://')[1],
      path: '/media/upload',
    });

    try {
      // USAR FETCH NATIVO - NO Axios
      // Fetch maneja automáticamente multipart/form-data correctamente en React Native
      const uploadUrl = `${config.apiUrl}/media/upload`;
      
      console.log('Initiating fetch request to:', uploadUrl);
      console.log('Request method: POST');
      console.log('Request headers:', {
        'Authorization': `Bearer ${token.substring(0, 20)}...`,
      });
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // NO establecer Content-Type - fetch lo establecerá automáticamente como multipart/form-data con boundary
        },
        body: formData, // FormData se serializa automáticamente
      });
      
      console.log('Fetch request completed, response received');

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          errorData = { error: errorText || `Error HTTP ${response.status}` };
        }
        
        console.error('Upload failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        throw new Error(errorData.error || `Error al subir imagen: ${response.status}`);
      }

      const data: UploadImageResponse = await response.json();
      console.log('Upload successful:', data);

      return data;
    } catch (error: any) {
      // Log detallado del error
      const errorDetails = {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack?.substring(0, 500),
        uploadUrl: `${config.apiUrl}/media/upload`,
        apiUrl: config.apiUrl,
      };
      
      console.error('Upload error details:', JSON.stringify(errorDetails, null, 2));

      // Si es un error de red, verificar si el backend está accesible
      if (
        error.message === 'Network request failed' ||
        error.message?.includes('Network') ||
        error.message?.includes('fetch') ||
        error.name === 'TypeError'
      ) {
        // Intentar verificar si el backend está accesible
        console.log('Verificando conectividad con el backend...');
        try {
          const healthCheck = await fetch(`${config.apiUrl}/health`, {
            method: 'GET',
            timeout: 5000,
          } as any);
          console.log('Health check response:', healthCheck.status);
        } catch (healthError) {
          console.error('Backend NO está accesible:', healthError);
        }
        
        const networkError: any = new Error(
          `Error de conexión. Backend: ${config.apiUrl}. ` +
          `Verifica que el backend esté corriendo en el puerto 3000 y accesible desde tu red.`
        );
        networkError.isNetworkError = true;
        networkError.code = 'ERR_NETWORK';
        networkError.details = errorDetails;
        throw networkError;
      }

      throw error;
    }
  }
}

export default new ImageService();
