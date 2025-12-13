import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { UserPayload } from '../types';

const prisma = new PrismaClient();

interface SocketWithUser extends Socket {
  userId?: string;
  profileId?: string;
}

export const setupSocketIO = (io: Server) => {
  io.use(async (socket: SocketWithUser, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Token no proporcionado'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;

      const profile = await prisma.profile.findUnique({
        where: { userId: decoded.id },
        select: { id: true },
      });

      if (profile) {
        socket.profileId = profile.id;
      }

      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: SocketWithUser) => {

    socket.on('join:chats', async () => {
      if (!socket.profileId) return;

      try {
        const chats = await prisma.chat.findMany({
          where: {
            OR: [
              { user1Id: socket.profileId },
              { user2Id: socket.profileId },
            ],
          },
        });

        chats.forEach((chat) => {
          socket.join(`chat:${chat.id}`);
        });
      } catch (error) {
        console.error('Error al unirse a chats:', error);
      }
    });

    socket.on('join:chat', async (chatId: string) => {
      if (!socket.profileId) {
        console.error('Error: socket.profileId no está definido al unirse al chat');
        return;
      }
      
      try {
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
          select: {
            user1Id: true,
            user2Id: true,
          },
        });
        
        if (!chat) {
          console.error('Chat no encontrado:', chatId);
          return;
        }
        
        if (chat.user1Id !== socket.profileId && chat.user2Id !== socket.profileId) {
          console.error('Usuario no autorizado para este chat:', {
            chatId,
            profileId: socket.profileId,
          });
          return;
        }
        
        socket.join(`chat:${chatId}`);
        console.log('Usuario unido al chat:', { chatId, profileId: socket.profileId });
      } catch (error) {
        console.error('Error al unirse al chat:', error);
      }
    });

    socket.on('message:send', async (data: { chatId: string; content: string; mediaId?: string }) => {
      if (!socket.profileId) {
        console.error('Error: socket.profileId no está definido');
        socket.emit('message:error', { error: 'No autorizado' });
        return;
      }
      
      const rooms = Array.from(socket.rooms);
      const chatRoom = `chat:${data.chatId}`;
      if (!rooms.includes(chatRoom)) {
        console.warn('Socket no está en la sala del chat, uniéndolo...', {
          chatId: data.chatId,
          profileId: socket.profileId,
          rooms,
        });
        socket.join(chatRoom);
      }

      try {
        const chat = await prisma.chat.findUnique({
          where: { id: data.chatId },
          select: {
            user1Id: true,
            user2Id: true,
          },
        });

        if (!chat) {
          console.error('Error: Chat no encontrado', { chatId: data.chatId, profileId: socket.profileId });
          socket.emit('message:error', { error: 'Chat no encontrado' });
          return;
        }

        if (chat.user1Id !== socket.profileId && chat.user2Id !== socket.profileId) {
          console.error('Error: Usuario no autorizado para este chat', {
            chatId: data.chatId,
            profileId: socket.profileId,
            chatUser1: chat.user1Id,
            chatUser2: chat.user2Id,
          });
          socket.emit('message:error', { error: 'No tienes acceso a este chat' });
          return;
        }

        if (!data.content && !data.mediaId) {
          socket.emit('message:error', { error: 'El mensaje debe tener contenido o una imagen' });
          return;
        }

        const message = await prisma.message.create({
          data: {
            chatId: data.chatId,
            senderId: socket.profileId,
            content: data.content || null,
            mediaId: data.mediaId || null,
            read: false,
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        });

        let media = null;
        if (data.mediaId) {
          media = await prisma.media.findUnique({
            where: { id: data.mediaId },
          });
          
          if (media) {
            await prisma.media.update({
              where: { id: data.mediaId },
              data: { messageId: message.id },
            });
          }
        }

        const messageWithMedia = {
          id: message.id,
          chatId: message.chatId,
          senderId: message.senderId,
          content: message.content,
          mediaId: message.mediaId,
          read: message.read,
          createdAt: message.createdAt.toISOString(),
          sender: message.sender,
          media: media ? {
            id: media.id,
            profileId: media.profileId,
            messageId: media.messageId,
            url: media.url,
            type: media.type,
            mimeType: media.mimeType,
            size: media.size,
            createdAt: media.createdAt.toISOString(),
          } : null,
        };

        await prisma.chat.update({
          where: { id: data.chatId },
          data: {
            lastMessage: data.content || (data.mediaId ? 'Imagen' : 'Mensaje'),
            lastMessageAt: new Date(),
          },
        });

        io.to(`chat:${data.chatId}`).emit('message:received', messageWithMedia);
        io.emit('chat:updated', { chatId: data.chatId });
      } catch (error: any) {
        console.error('Error al enviar mensaje:', error);
        socket.emit('message:error', { error: error.message || 'Error al enviar mensaje' });
      }
    });

    socket.on('typing:start', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('typing:start', {
        userId: socket.userId,
        profileId: socket.profileId,
      });
    });

    socket.on('typing:stop', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('typing:stop', {
        userId: socket.userId,
        profileId: socket.profileId,
      });
    });

    socket.on('messages:read', async (data: { chatId: string; messageIds: string[] }) => {
      if (!socket.profileId) return;

      try {
        await prisma.message.updateMany({
          where: {
            id: { in: data.messageIds },
            chatId: data.chatId,
            senderId: { not: socket.profileId },
            read: false,
          },
          data: {
            read: true,
          },
        });

        socket.to(`chat:${data.chatId}`).emit('messages:read', {
          messageIds: data.messageIds,
        });
      } catch (error) {
        console.error('Error al marcar mensajes como leídos:', error);
      }
    });

    socket.on('disconnect', () => {
    });
  });
};

