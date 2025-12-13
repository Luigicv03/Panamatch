import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();

export const getCandidates = async (
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

    const swipedProfiles = await prisma.swipe.findMany({
      where: { swipedBy: currentProfile.id },
      select: { swipedOn: true },
    });
    const swipedIds = swipedProfiles.map((s) => s.swipedOn);

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

    const excludeIds = [...swipedIds, ...matchedIds, currentProfile.id];

    let candidates = await prisma.profile.findMany({
      where: {
        AND: [
          { id: { notIn: excludeIds } },
          { city: currentProfile.city },
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
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

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

    const formattedCandidates = candidates.map((profile) => ({
      ...profile,
      avatarUrl: profile.avatarUrl,
      interests: profile.interests.map((ui) => ui.interest),
    }));
    res.json(formattedCandidates);
  } catch (error) {
    console.error('Error al obtener candidatos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const likeCandidate = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const { id } = req.params;
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const candidateProfile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!candidateProfile) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }

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

    await prisma.swipe.create({
      data: {
        swipedBy: currentProfile.id,
        swipedOn: id,
        action: 'like',
      },
    });

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

      const chat = await prisma.chat.create({
        data: {
          matchId: match.id,
          user1Id: currentProfile.id,
          user2Id: id,
        },
      });

      match.chat = chat;
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
            chat: match.chat || null,
          }
        : null,
      message: match ? '¡Hiciste un match!' : 'Like registrado',
    });
  } catch (error) {
    console.error('Error al dar like:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const dislikeCandidate = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const { id } = req.params;
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!currentProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const candidateProfile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!candidateProfile) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }

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

