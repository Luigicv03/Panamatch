import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { RequestWithUser } from '../types';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);
      (req as RequestWithUser).user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Token inválido o expirado' });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'Error en autenticación' });
    return;
  }
};

