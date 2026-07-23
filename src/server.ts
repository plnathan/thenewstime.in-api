import dotenv from "dotenv";
import app from "./app.js";
import { pool } from "./shared/config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    //console.log("DATABASE_URL:", process.env.DATABASE_URL);
    await pool.query("SELECT 1");
    console.log("Database connected successfully");
    // const dbInfo = await pool.query(`
    //   SELECT current_database() AS db_name, current_schema() AS schema_name
    // `);
    // console.log("Connected DB info:", dbInfo.rows[0]);

    // const newsCheck = await pool.query(`
    //   SELECT COUNT(*)::int AS total
    //   FROM public.news
    // `);
    // console.log("public.news check:", newsCheck.rows[0]);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
