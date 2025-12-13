import { Router } from 'express';
import {
  getCandidates,
  likeCandidate,
  dislikeCandidate,
  getMatches,
} from '../controllers/swipeController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/candidates', getCandidates);
router.post('/like/:id', likeCandidate);
router.post('/dislike/:id', dislikeCandidate);
router.get('/matches', getMatches);

export default router;

