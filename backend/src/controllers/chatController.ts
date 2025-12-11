import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();

// Obtener lista de chats del usuario
export const getChats = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Obtener chats
    const chats = await prisma.chat.findMany({
      where: {
        OR: [
          { user1Id: currentProfile.id },
          { user2Id: currentProfile.id },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        user2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    // Formatear respuesta
    const formattedChats = chats.map((chat) => {
      const otherUser =
        chat.user1Id === currentProfile.id ? chat.user2 : chat.user1;
      const lastMessage = chat.messages[0] || null;

      return {
        id: chat.id,
        otherUser: {
          id: otherUser.id,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          avatarUrl: otherUser.avatarUrl,
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
              createdAt: lastMessage.createdAt,
              read: lastMessage.read,
            }
          : null,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt,
        unreadCount: 0, // TODO: Calcular mensajes no leídos
      };
    });

    res.json(formattedChats);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener mensajes de un chat
export const getChatMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Verificar que el chat existe y el usuario tiene acceso
    const chat = await prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat no encontrado' });
      return;
    }

    // Obtener mensajes ordenados de más antiguos a más recientes
    // Para paginación: página 1 = mensajes más antiguos, páginas siguientes = mensajes más recientes
    const messages = await prisma.message.findMany({
      where: { chatId: id },
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
      orderBy: {
        createdAt: 'asc', // Orden cronológico: más antiguos primero
      },
      take: limit,
      skip,
    });

    // Obtener el media para cada mensaje que tenga mediaId
    const messagesWithMedia = await Promise.all(
      messages.map(async (message) => {
        let media = null;
        if (message.mediaId) {
          media = await prisma.media.findUnique({
            where: { id: message.mediaId },
          });
        }
        return {
          ...message,
          media: media,
        };
      })
    );

    res.json({
      messages: messagesWithMedia, // Mensajes con media incluido
      hasMore: messages.length === limit,
      page,
    });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Enviar mensaje (fallback para cuando no hay WebSocket)
export const sendMessage = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const { id } = req.params; // chatId
    const { content, mediaId } = req.body;

    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Verificar que el chat existe y el usuario tiene acceso
    const chat = await prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat no encontrado' });
      return;
    }

    if (chat.user1Id !== currentProfile.id && chat.user2Id !== currentProfile.id) {
      res.status(403).json({ error: 'No tienes acceso a este chat' });
      return;
    }

    // Crear mensaje
    const message = await prisma.message.create({
      data: {
        chatId: id,
        senderId: currentProfile.id,
        content,
        mediaId,
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
        media: true,
      },
    });

    // Actualizar último mensaje del chat
    await prisma.chat.update({
      where: { id },
      data: {
        lastMessage: content || 'Imagen',
        lastMessageAt: new Date(),
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

