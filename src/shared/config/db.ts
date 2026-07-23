// This is used to create the PostgreSQL connection pool.

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
// ------------------------------
/*
Why rejectUnauthorized: false?

Neon usually needs SSL. This setting is commonly used for hosted Postgres connections in app code. 
If later you want a stricter SSL setup, you can refine it.
*/
