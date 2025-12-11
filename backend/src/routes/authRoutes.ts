import { Router } from 'express';
import { register, login, logout, refresh, updateEmail } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.post('/refresh', refresh);
router.put('/me/email', authMiddleware, updateEmail);

export default router;

