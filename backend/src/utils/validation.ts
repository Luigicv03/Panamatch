import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token es requerido'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  dateOfBirth: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime()) && val.match(/^\d{4}-\d{2}-\d{2}$/);
  }, {
    message: 'Fecha de nacimiento inválida. Use formato YYYY-MM-DD (ej: 1995-05-15)',
  }),
  gender: z.string().min(1, 'El género es requerido'),
  city: z.string().min(1, 'La ciudad es requerida'),
  bio: z.string().max(150, 'La bio no puede exceder 150 caracteres').optional(),
  interests: z.array(z.string()).optional(),
});

export const updateEmailSchema = z.object({
  email: z.string().email('Email inválido'),
});

