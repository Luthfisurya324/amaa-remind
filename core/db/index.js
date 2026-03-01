import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL credentials in .env');
}

// For query purposes
const queryClient = postgres(process.env.DATABASE_URL || '', { prepare: false });
export const db = drizzle(queryClient, { schema });
