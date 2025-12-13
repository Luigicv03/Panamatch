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
    const token = await AsyncStorage.getItem(config.tokenStorageKey);
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const formData = new FormData();
    
    let filename = imageUri.split('/').pop() || 'image.jpg';
    
    filename = filename.split('?')[0];
    
    if (!filename.includes('.')) {
      filename = `${filename}.jpg`;
    }

    let mimeType = 'image/jpeg';
    const match = /\.(\w+)$/.exec(filename.toLowerCase());
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
    }

    const fileUri = imageUri;

    formData.append('image', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);
    
    formData.append('type', type);

    try {
      const uploadUrl = `${config.apiUrl}/media/upload`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          errorData = { error: errorText || `Error HTTP ${response.status}` };
        }
        
        throw new Error(errorData.error || `Error al subir imagen: ${response.status}`);
      }

      const data: UploadImageResponse = await response.json();
      return data;
    } catch (error: any) {
      if (
        error.message === 'Network request failed' ||
        error.message?.includes('Network') ||
        error.message?.includes('fetch') ||
        error.name === 'TypeError'
      ) {
        const networkError: any = new Error(
          `Error de conexión. Backend: ${config.apiUrl}. Verifica que el backend esté corriendo.`
        );
        networkError.isNetworkError = true;
        networkError.code = 'ERR_NETWORK';
        throw networkError;
      }

      throw error;
    }
  }
}

export default new ImageService();
