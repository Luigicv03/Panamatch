import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Obtener todos los intereses disponibles
router.get('/', async (req, res) => {
  try {
    const interests = await prisma.interest.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json(interests);
  } catch (error) {
    console.error('Error al obtener intereses:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;

