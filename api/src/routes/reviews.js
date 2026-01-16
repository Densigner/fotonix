import express from 'express';
import { applyVote, getCounts } from '../../db/pool.js';

const router = express.Router();

router.post('/:id/helpful', async (req, res) => {
  try {
    const id = req.params.id;
    const vote = req.body && req.body.vote;
    if (!['up', 'down', 'clear'].includes(vote)) return res.status(400).json({ error: 'invalid vote' });
    const counts = await applyVote(id, vote);
    res.json(counts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/helpful', async (req, res) => {
  try {
    const id = req.params.id;
    const counts = await getCounts(id);
    res.json(counts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
