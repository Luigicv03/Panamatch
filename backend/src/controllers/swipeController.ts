import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();

// Obtener candidatos para swipe
export const getCandidates = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Obtener perfil del usuario actual
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Obtener IDs de usuarios ya swipados (likes y dislikes)
    const swipedProfiles = await prisma.swipe.findMany({
      where: { swipedBy: currentProfile.id },
      select: { swipedOn: true },
    });
    const swipedIds = swipedProfiles.map((s) => s.swipedOn);

    // Obtener IDs de usuarios que ya hicieron match
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: currentProfile.id },
          { user2Id: currentProfile.id },
        ],
      },
      select: {
        user1Id: true,
        user2Id: true,
      },
    });
    const matchedIds = matches.flatMap((m) =>
      m.user1Id === currentProfile.id ? [m.user2Id] : [m.user1Id]
    );

    // IDs a excluir
    const excludeIds = [...swipedIds, ...matchedIds, currentProfile.id];

    // Obtener candidatos (misma ciudad o ciudades cercanas)
    // Por ahora, filtramos por misma ciudad. En producción, agregar lógica de distancia
    let candidates = await prisma.profile.findMany({
      where: {
        AND: [
          { id: { notIn: excludeIds } },
          { city: currentProfile.city }, // Misma ciudad
          { userId: { not: req.user.id } }, // No el mismo usuario
        ],
      },
      include: {
        interests: {
          include: {
            interest: true,
          },
        },
      },
      take: 10, // Limitar resultados
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Si no hay suficientes candidatos en la misma ciudad, expandir búsqueda
    if (candidates.length < 5) {
      const additionalCandidates = await prisma.profile.findMany({
        where: {
          AND: [
            { id: { notIn: excludeIds } },
            { city: { not: currentProfile.city } },
            { userId: { not: req.user.id } },
          ],
        },
        include: {
          interests: {
            include: {
              interest: true,
            },
          },
        },
        take: 10 - candidates.length,
        orderBy: {
          createdAt: 'desc',
        },
      });
      candidates = [...candidates, ...additionalCandidates];
    }

    // Formatear respuesta - Asegurar que avatarUrl se incluya explícitamente
    const formattedCandidates = candidates.map((profile) => {
      console.log('📸 Perfil candidato:', {
        id: profile.id,
        firstName: profile.firstName,
        avatarUrl: profile.avatarUrl,
        hasAvatarUrl: !!profile.avatarUrl,
      });
      
      return {
        ...profile,
        avatarUrl: profile.avatarUrl, // Asegurar que se incluya explícitamente
        interests: profile.interests.map((ui) => ui.interest),
      };
    });

    console.log('📤 Enviando candidatos:', formattedCandidates.length, 'perfiles');
    res.json(formattedCandidates);
  } catch (error) {
    console.error('Error al obtener candidatos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Dar like a un candidato
export const likeCandidate = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const { id } = req.params; // ID del perfil al que se le da like
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Verificar que el candidato existe
    const candidateProfile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!candidateProfile) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }

    // Verificar que no se haya swipado antes
    const existingSwipe = await prisma.swipe.findUnique({
      where: {
        swipedBy_swipedOn: {
          swipedBy: currentProfile.id,
          swipedOn: id,
        },
      },
    });

    if (existingSwipe) {
      res.status(400).json({ error: 'Ya has swipado a este usuario' });
      return;
    }

    // Crear swipe
    await prisma.swipe.create({
      data: {
        swipedBy: currentProfile.id,
        swipedOn: id,
        action: 'like',
      },
    });

    // Verificar si hay match (el otro usuario ya dio like)
    const mutualLike = await prisma.swipe.findUnique({
      where: {
        swipedBy_swipedOn: {
          swipedBy: id,
          swipedOn: currentProfile.id,
        },
      },
    });

    let match = null;
    if (mutualLike && mutualLike.action === 'like') {
      // Crear match
      match = await prisma.match.create({
        data: {
          user1Id: currentProfile.id,
          user2Id: id,
        },
        include: {
          user1: {
            include: {
              interests: {
                include: {
                  interest: true,
                },
              },
            },
          },
          user2: {
            include: {
              interests: {
                include: {
                  interest: true,
                },
              },
            },
          },
        },
      });

      // Crear chat para el match
      await prisma.chat.create({
        data: {
          matchId: match.id,
          user1Id: currentProfile.id,
          user2Id: id,
        },
      });
    }

    res.json({
      match: match
        ? {
            ...match,
            user1: {
              ...match.user1,
              interests: match.user1.interests.map((ui) => ui.interest),
            },
            user2: {
              ...match.user2,
              interests: match.user2.interests.map((ui) => ui.interest),
            },
          }
        : null,
      message: match ? '¡Hiciste un match!' : 'Like registrado',
    });
  } catch (error) {
    console.error('Error al dar like:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Dar dislike a un candidato
export const dislikeCandidate = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const { id } = req.params; // ID del perfil al que se le da dislike
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Verificar que el candidato existe
    const candidateProfile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!candidateProfile) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }

    // Verificar que no se haya swipado antes
    const existingSwipe = await prisma.swipe.findUnique({
      where: {
        swipedBy_swipedOn: {
          swipedBy: currentProfile.id,
          swipedOn: id,
        },
      },
    });

    if (existingSwipe) {
      res.status(400).json({ error: 'Ya has swipado a este usuario' });
      return;
    }

    // Crear swipe de dislike
    await prisma.swipe.create({
      data: {
        swipedBy: currentProfile.id,
        swipedOn: id,
        action: 'dislike',
      },
    });

    res.json({ message: 'Dislike registrado' });
  } catch (error) {
    console.error('Error al dar dislike:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener matches del usuario
export const getMatches = async (
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

    // Obtener matches
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: currentProfile.id },
          { user2Id: currentProfile.id },
        ],
      },
      include: {
        user1: {
          include: {
            interests: {
              include: {
                interest: true,
              },
            },
          },
        },
        user2: {
          include: {
            interests: {
              include: {
                interest: true,
              },
            },
          },
        },
        chat: {
          include: {
            messages: {
              take: 1,
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Formatear respuesta
    const formattedMatches = matches.map((match) => {
      const otherUser =
        match.user1Id === currentProfile.id ? match.user2 : match.user1;

      return {
        id: match.id,
        createdAt: match.createdAt,
        user: {
          ...otherUser,
          interests: otherUser.interests.map((ui) => ui.interest),
        },
        chat: match.chat
          ? {
              ...match.chat,
              lastMessage: match.chat.messages[0]?.content || null,
              lastMessageAt: match.chat.messages[0]?.createdAt || null,
            }
          : null,
      };
    });

    res.json(formattedMatches);
  } catch (error) {
    console.error('Error al obtener matches:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

