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
  // Middleware de autenticación para Socket.IO
  io.use(async (socket: SocketWithUser, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Token no proporcionado'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;

      // Obtener profileId
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
    console.log('Usuario conectado:', socket.userId);

    // Unirse a salas de chats del usuario
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

    // Unirse a un chat específico
    socket.on('join:chat', (chatId: string) => {
      socket.join(`chat:${chatId}`);
    });

    // Enviar mensaje
    socket.on('message:send', async (data: { chatId: string; content: string; mediaId?: string }) => {
      if (!socket.profileId) {
        console.error('Error: socket.profileId no está definido');
        socket.emit('message:error', { error: 'No autorizado' });
        return;
      }

      try {
        // VALIDACIÓN CRÍTICA: Verificar que el chat existe y pertenece al usuario autenticado
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

        // Verificar que el usuario autenticado es parte del chat
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

        // Validar que el mensaje tenga contenido o media
        if (!data.content && !data.mediaId) {
          socket.emit('message:error', { error: 'El mensaje debe tener contenido o una imagen' });
          return;
        }

        // Crear mensaje en la BD con el senderId correcto del socket autenticado
        const message = await prisma.message.create({
          data: {
            chatId: data.chatId,
            senderId: socket.profileId, // Asegurar que usa el profileId del socket autenticado
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

        // Obtener el media si existe
        let media = null;
        if (data.mediaId) {
          // Buscar el media por ID
          media = await prisma.media.findUnique({
            where: { id: data.mediaId },
          });
          
          // Actualizar el media para vincularlo con el mensaje
          if (media) {
            await prisma.media.update({
              where: { id: data.mediaId },
              data: { messageId: message.id },
            });
          }
        }

        // Construir el mensaje completo con sender y media
        // IMPORTANTE: Asegurar que el objeto media esté correctamente serializado
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

        console.log('📤 Mensaje creado para emitir:', {
          messageId: message.id,
          chatId: data.chatId,
          senderId: message.senderId,
          senderName: `${message.sender.firstName} ${message.sender.lastName}`,
          hasMedia: !!media,
          mediaId: media?.id,
          mediaUrl: media?.url,
          mediaObject: media,
          fullMessage: JSON.stringify(messageWithMedia, null, 2),
        });

        // Actualizar último mensaje del chat
        await prisma.chat.update({
          where: { id: data.chatId },
          data: {
            lastMessage: data.content || (data.mediaId ? 'Imagen' : 'Mensaje'),
            lastMessageAt: new Date(),
          },
        });

        // Emitir mensaje a todos en el chat (con media incluido)
        io.to(`chat:${data.chatId}`).emit('message:received', messageWithMedia);

        // Actualizar lista de chats para ambos usuarios
        io.emit('chat:updated', { chatId: data.chatId });
      } catch (error: any) {
        console.error('Error al enviar mensaje:', error);
        socket.emit('message:error', { error: error.message || 'Error al enviar mensaje' });
      }
    });

    // Indicador de escritura
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

    // Marcar mensajes como leídos
    socket.on('messages:read', async (data: { chatId: string; messageIds: string[] }) => {
      if (!socket.profileId) return;

      try {
        await prisma.message.updateMany({
          where: {
            id: { in: data.messageIds },
            chatId: data.chatId,
            senderId: { not: socket.profileId }, // Solo marcar mensajes del otro usuario
            read: false,
          },
          data: {
            read: true,
          },
        });

        // Notificar al otro usuario
        socket.to(`chat:${data.chatId}`).emit('messages:read', {
          messageIds: data.messageIds,
        });
      } catch (error) {
        console.error('Error al marcar mensajes como leídos:', error);
      }
    });

    // Desconexión
    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.userId);
    });
  });
};

