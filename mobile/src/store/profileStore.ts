import { create } from 'zustand';
import { Profile, Interest } from '../types';
import profileService from '../services/profileService';

interface ProfileState {
  profile: Profile | null;
  interests: Interest[];
  isLoading: boolean;
  profileNotFound: boolean;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  fetchInterests: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  resetProfileNotFound: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  interests: [],
  isLoading: false,
  profileNotFound: false,

  setProfile: (profile) => set({ profile, profileNotFound: false }),

  fetchProfile: async () => {
    set({ isLoading: true, profileNotFound: false });
    try {
      const profile = await profileService.getCurrentProfile();
      set({ profile, isLoading: false, profileNotFound: false });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        set({ profile: null, isLoading: false, profileNotFound: true });
        return;
      }
      set({ profile: null, isLoading: false, profileNotFound: false });
      throw error;
    }
  },

  resetProfileNotFound: () => set({ profileNotFound: false }),

  fetchInterests: async () => {
    try {
      const interests = await profileService.getInterests();
      set({ interests });
    } catch (error) {
    }
  },

  updateProfile: async (data) => {
    const currentProfile = get().profile;
    if (!currentProfile) return;

    try {
      const updatedProfile = await profileService.updateProfile(data as any);
      set({ profile: updatedProfile });
    } catch (error) {
      throw error;
    }
  },
}));

