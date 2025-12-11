import api from './api';
import { Profile, Match } from '../types';

class SwipeService {
  async getCandidates(): Promise<Profile[]> {
    const response = await api.get<Profile[]>('/swipe/candidates');
    return response.data;
  }

  async likeCandidate(profileId: string): Promise<{ match: Match | null; message: string }> {
    const response = await api.post<{ match: Match | null; message: string }>(
      `/swipe/like/${profileId}`
    );
    return response.data;
  }

  async dislikeCandidate(profileId: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`/swipe/dislike/${profileId}`);
    return response.data;
  }

  async getMatches(): Promise<Match[]> {
    const response = await api.get<Match[]>('/swipe/matches');
    return response.data;
  }
}

export default new SwipeService();

