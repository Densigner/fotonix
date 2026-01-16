#!/usr/bin/env node
import path from 'path';
import { runSqlFile } from '../db/pool.js';

const sqlPath = path.resolve(process.cwd(), 'api', 'db', 'seed', 'seed_reviews.sql');
runSqlFile(sqlPath).then(() => {
  console.log('Seed applied');
  process.exit(0);
}).catch(err => {
  console.error('Seed failed', err);
  process.exit(2);
});
