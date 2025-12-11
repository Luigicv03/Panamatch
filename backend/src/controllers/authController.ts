import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { registerSchema, loginSchema, refreshTokenSchema, updateEmailSchema } from '../utils/validation';
import { RequestWithUser } from '../types';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validar datos
    const validatedData = registerSchema.parse(req.body);

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'El email ya está registrado' });
      return;
    }

    // Hashear contraseña
    const hashedPassword = await hashPassword(validatedData.password);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
      },
    });

    // Generar tokens
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      return;
    }
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validar datos
    const validatedData = loginSchema.parse(req.body);

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      include: { profile: { include: { interests: { include: { interest: true } } } } },
    });

    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Verificar contraseña
    const isPasswordValid = await comparePassword(validatedData.password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Generar tokens
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Formatear respuesta del usuario
    const userResponse = {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      profile: user.profile
        ? {
            ...user.profile,
            interests: user.profile.interests.map((ui) => ui.interest),
          }
        : null,
    };

    res.json({
      accessToken,
      refreshToken,
      user: userResponse,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      return;
    }
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const logout = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    // Aquí podrías invalidar el refresh token en la BD si lo guardas
    // Por ahora solo devolvemos éxito
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validar datos
    const validatedData = refreshTokenSchema.parse(req.body);

    // Verificar refresh token
    const decoded = verifyRefreshToken(validatedData.refreshToken);

    // Verificar que el usuario aún existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      res.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Generar nuevo access token
    const accessToken = generateAccessToken({ id: user.id, email: user.email });

    res.json({ accessToken });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      return;
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Refresh token inválido o expirado' });
      return;
    }
    console.error('Error en refresh:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateEmail = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Validar datos
    const validatedData = updateEmailSchema.parse(req.body);

    // Verificar si el nuevo email ya está en uso por otro usuario
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser && existingUser.id !== req.user.id) {
      res.status(400).json({ error: 'El email ya está registrado' });
      return;
    }

    // Verificar que el usuario existe
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!currentUser) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Si el email es el mismo, no hacer nada
    if (currentUser.email === validatedData.email) {
      res.json({ 
        message: 'El email no ha cambiado',
        user: {
          id: currentUser.id,
          email: currentUser.email,
        }
      });
      return;
    }

    // Actualizar email
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        email: validatedData.email,
      },
    });

    // Generar nuevos tokens con el email actualizado
    const accessToken = generateAccessToken({ id: updatedUser.id, email: updatedUser.email });
    const refreshToken = generateRefreshToken({ id: updatedUser.id, email: updatedUser.email });

    res.json({
      message: 'Email actualizado correctamente',
      accessToken,
      refreshToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      const firstError = error.errors[0];
      const errorMessage = firstError?.message || 'Datos inválidos';
      res.status(400).json({ 
        error: errorMessage,
        details: error.errors 
      });
      return;
    }
    console.error('Error al actualizar email:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

