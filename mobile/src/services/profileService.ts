import api from './api';
import imageService from './imageService';
import { Profile, Interest } from '../types';

class ProfileService {
  async getCurrentProfile(): Promise<Profile> {
    const response = await api.get<Profile>('/users/me');
    return response.data;
  }

  async createProfile(data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    city: string;
    bio?: string;
    interests?: string[];
  }): Promise<Profile> {
    const response = await api.post<Profile>('/users/me', data);
    return response.data;
  }

  async updateProfile(data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    city: string;
    bio?: string;
    interests?: string[];
  }): Promise<Profile> {
    const response = await api.put<Profile>('/users/me', data);
    return response.data;
  }

  async uploadAvatar(imageUri: string): Promise<{ avatarUrl: string }> {
    // Usar el servicio de imágenes para subir el avatar
    const result = await imageService.uploadImage(imageUri, 'profile');
    return { avatarUrl: result.url };
  }

  async getPublicProfile(userId: string): Promise<Profile> {
    const response = await api.get<Profile>(`/users/${userId}`);
    return response.data;
  }

  async getInterests(): Promise<Interest[]> {
    const response = await api.get<Interest[]>('/interests');
    return response.data;
  }
}

export default new ProfileService();

