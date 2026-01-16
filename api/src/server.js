import express from 'express';
import dotenv from 'dotenv';
import reviews from './routes/reviews.js';

dotenv.config();
const app = express();
app.use(express.json());
app.use('/reviews', reviews);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on ${port}`));
