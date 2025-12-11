// Tipos TypeScript para el backend
import { Request } from 'express';

export interface UserPayload {
  id: string;
  email: string;
}

export interface RequestWithUser extends Request {
  user?: UserPayload;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

