import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { updateProfileSchema } from '../utils/validation';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();

export const getCurrentProfile = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
      include: {
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const formattedProfile = {
      ...profile,
      avatarUrl: profile.avatarUrl,
      interests: profile.interests.map((ui) => ui.interest),
    };

    res.json(formattedProfile);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createProfile = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Validar datos
    const validatedData = updateProfileSchema.parse(req.body);
    const { interests, ...profileData } = validatedData as any;

    // Verificar si el perfil ya existe
    const existingProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (existingProfile) {
      res.status(400).json({ error: 'El perfil ya existe' });
      return;
    }

    // Validar y convertir fecha de nacimiento
    let birthDate: Date;
    if (typeof validatedData.dateOfBirth === 'string') {
      // Intentar parsear la fecha
      birthDate = new Date(validatedData.dateOfBirth);
      // Verificar que la fecha sea válida
      if (isNaN(birthDate.getTime())) {
        console.error('Fecha inválida recibida:', validatedData.dateOfBirth);
        res.status(400).json({ error: 'Fecha de nacimiento inválida. Use formato YYYY-MM-DD' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Fecha de nacimiento inválida' });
      return;
    }

    // Calcular edad mínima (18 años)
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (age < 18 || (age === 18 && monthDiff < 0)) {
      res.status(400).json({ error: 'Debes ser mayor de 18 años' });
      return;
    }

    // Crear perfil
    const profile = await prisma.profile.create({
      data: {
        userId: req.user.id,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        dateOfBirth: birthDate,
        gender: validatedData.gender,
        city: validatedData.city,
        bio: validatedData.bio,
        interests: interests
          ? {
              create: interests.map((interestId: string) => ({
                interestId,
              })),
            }
          : undefined,
      },
      include: {
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    // Formatear respuesta
    const formattedProfile = {
      ...profile,
      interests: profile.interests.map((ui) => ui.interest),
    };

    res.status(201).json(formattedProfile);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      return;
    }
    console.error('Error al crear perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateProfile = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Validar datos
    const validatedData = updateProfileSchema.parse(req.body);
    const { interests, ...profileData } = validatedData as any;

    // Verificar que el perfil existe
    const existingProfile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!existingProfile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Actualizar perfil
    const profile = await prisma.profile.update({
      where: { userId: req.user.id },
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        gender: validatedData.gender,
        city: validatedData.city,
        bio: validatedData.bio,
        ...(interests && {
          interests: {
            deleteMany: {},
            create: interests.map((interestId: string) => ({
              interestId,
            })),
          },
        }),
      },
      include: {
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    // Formatear respuesta
    const formattedProfile = {
      ...profile,
      interests: profile.interests.map((ui) => ui.interest),
    };

    res.json(formattedProfile);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error('Error de validación Zod:', error.errors);
      const firstError = error.errors[0];
      const errorMessage = firstError?.message || 'Datos inválidos';
      res.status(400).json({ 
        error: errorMessage,
        details: error.errors 
      });
      return;
    }
    console.error('Error al actualizar perfil:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const uploadAvatar = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Usar el endpoint de media para subir
    // Esta función ahora se maneja en mediaRoutes
    res.status(501).json({ error: 'Use POST /media/upload with type=profile' });
  } catch (error) {
    console.error('Error al subir avatar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getPublicProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const profile = await prisma.profile.findUnique({
      where: { id },
      include: {
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // Formatear respuesta (sin información sensible)
    const formattedProfile = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      city: profile.city,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      interests: profile.interests.map((ui) => ui.interest),
    };

    res.json(formattedProfile);
  } catch (error) {
    console.error('Error al obtener perfil público:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

