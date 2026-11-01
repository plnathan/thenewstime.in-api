// This is used to create the PostgreSQL connection pool.

import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true
});

pool.on("error", (error: Error) => {
  console.error("[PostgreSQL] Idle connection error:", error.message);
});

// Check the Neon connection
// When the error occurs, run these commands in PowerShell:

// nslookup ep-divine-queen-aok5env3-pooler.c-2.ap-southeast-1.aws.neon.tech

// Test-NetConnection ep-divine-queen-aok5env3-pooler.c-2.ap-southeast-1.aws.neon.tech -Port 5432

// ------------------------------
/*
Why rejectUnauthorized: false?

Neon usually needs SSL. This setting is commonly used for hosted Postgres connections in app code. 
If later you want a stricter SSL setup, you can refine it.
*/
