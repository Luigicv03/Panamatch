import { io, Socket } from 'socket.io-client';
import { config } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  async connect(): Promise<Socket> {
    const token = await AsyncStorage.getItem(config.tokenStorageKey);
    
    if (this.socket?.connected && token !== this.currentToken) {
      this.disconnect();
    }

    if (this.socket?.connected && token === this.currentToken) {
      return this.socket;
    }

    this.currentToken = token;

    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    return new Promise((resolve, reject) => {
      this.socket = io(config.socketUrl, {
        auth: {
          token,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: false,
      });

      const onConnect = () => {
        this.socket?.emit('join:chats');
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
        resolve(this.socket!);
      };

      const onError = (error: any) => {
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
        reject(error);
      };

      if (this.socket.connected) {
        this.socket.emit('join:chats');
        resolve(this.socket);
      } else {
        this.socket.on('connect', onConnect);
        this.socket.on('connect_error', onError);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }
  }

  async reconnect(): Promise<Socket> {
    this.disconnect();
    return this.connect();
  }

  joinChat(chatId: string): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }
    this.socket.emit('join:chat', chatId);
  }

  leaveChat(chatId: string): void {
  }

  sendMessage(chatId: string, content: string, mediaId?: string): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket no conectado');
    }
    this.socket.emit('message:send', { chatId, content, mediaId });
  }

  startTyping(chatId: string): void {
    this.socket?.emit('typing:start', { chatId });
  }

  stopTyping(chatId: string): void {
    this.socket?.emit('typing:stop', { chatId });
  }

  markMessagesAsRead(chatId: string, messageIds: string[]): void {
    this.socket?.emit('messages:read', { chatId, messageIds });
  }

  onMessage(callback: (message: any) => void): void {
    this.socket?.on('message:received', callback);
  }

  offMessage(callback: (message: any) => void): void {
    this.socket?.off('message:received', callback);
  }

  onTypingStart(callback: (data: any) => void): void {
    this.socket?.on('typing:start', callback);
  }

  offTypingStart(callback: (data: any) => void): void {
    this.socket?.off('typing:start', callback);
  }

  onTypingStop(callback: (data: any) => void): void {
    this.socket?.on('typing:stop', callback);
  }

  offTypingStop(callback: (data: any) => void): void {
    this.socket?.off('typing:stop', callback);
  }

  onChatUpdated(callback: (data: { chatId: string }) => void): void {
    this.socket?.on('chat:updated', callback);
  }

  onMessagesRead(callback: (data: { messageIds: string[] }) => void): void {
    this.socket?.on('messages:read', callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export default new SocketService();

