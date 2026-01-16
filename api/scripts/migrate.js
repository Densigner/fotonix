#!/usr/bin/env node
import path from 'path';
import { runSqlFile } from '../db/pool.js';

const sqlPath = path.resolve(process.cwd(), 'api', 'db', 'migrations', '001_init.sql');
runSqlFile(sqlPath).then(() => {
  console.log('Migration applied');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed', err);
  process.exit(2);
});
