import { pool } from "../../../../../shared/config/db.js";

export const cleanupNews = async (id: number) => {
  await pool.query("DELETE FROM news WHERE id=$1", [id]);
};

export const closeDatabase = async () => {
  await pool.end();
};
