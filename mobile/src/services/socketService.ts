import { io, Socket } from 'socket.io-client';
import { config } from '../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  async connect(): Promise<Socket> {
    const token = await AsyncStorage.getItem(config.tokenStorageKey);
    
    // Si el token cambió, desconectar y reconectar
    if (this.socket?.connected && token !== this.currentToken) {
      console.log('Token cambió, reconectando socket...');
      this.disconnect();
    }

    // Si ya hay una conexión activa con el mismo token, reutilizarla
    if (this.socket?.connected && token === this.currentToken) {
      return this.socket;
    }

    // Guardar el token actual
    this.currentToken = token;

    if (!token) {
      console.error('No hay token disponible para conectar el socket');
      throw new Error('No hay token de autenticación');
    }

    this.socket = io(config.socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true, // Forzar nueva conexión para asegurar que use el token correcto
    });

    this.socket.on('connect', () => {
      console.log('Socket conectado con userId:', this.socket?.id);
      // Unirse a chats del usuario
      this.socket?.emit('join:chats');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Error de conexión Socket:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      console.log('Desconectando socket...');
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }
  }

  // Método para reconectar con nuevo token (útil después de login)
  async reconnect(): Promise<Socket> {
    this.disconnect();
    return this.connect();
  }

  joinChat(chatId: string): void {
    this.socket?.emit('join:chat', chatId);
  }

  leaveChat(chatId: string): void {
    // No hay método leave en socket.io client, se hace automáticamente al desconectar
    // Solo emitir evento si es necesario
  }

  sendMessage(chatId: string, content: string, mediaId?: string): void {
    this.socket?.emit('message:send', { chatId, content, mediaId });
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

  onTypingStop(callback: (data: any) => void): void {
    this.socket?.on('typing:stop', callback);
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

