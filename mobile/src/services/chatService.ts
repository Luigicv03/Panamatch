import api from './api';
import { Chat, Message } from '../types';

interface ChatListResponse {
  id: string;
  otherUser: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    read: boolean;
  } | null;
  lastMessageAt?: string;
  createdAt: string;
  unreadCount: number;
}

class ChatService {
  async getChats(): Promise<ChatListResponse[]> {
    const response = await api.get<ChatListResponse[]>('/chats');
    return response.data;
  }

  async getChatMessages(
    chatId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ messages: Message[]; hasMore: boolean; page: number }> {
    const response = await api.get<{ messages: Message[]; hasMore: boolean; page: number }>(
      `/chats/${chatId}/messages`,
      {
        params: { page, limit },
      }
    );
    return response.data;
  }

  async sendMessage(
    chatId: string,
    content: string,
    mediaId?: string
  ): Promise<Message> {
    const response = await api.post<Message>(`/chats/${chatId}/messages`, {
      content,
      mediaId,
    });
    return response.data;
  }
}

export default new ChatService();

