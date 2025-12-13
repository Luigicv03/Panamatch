import { Router } from 'express';
import {
  getChats,
  getChatMessages,
  sendMessage,
} from '../controllers/chatController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getChats);
router.get('/:id/messages', getChatMessages);
router.post('/:id/messages', sendMessage);

export default router;

