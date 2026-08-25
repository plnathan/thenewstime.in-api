import cors from "cors";
import express from "express";

import newsReadsRoutes from "./api/v1/news-reads/news-reads.routes.js";
import newsRoutes from "./api/v1/news/news.routes.js";

import { errorHandler } from "./shared/middleware/error.middleware.js";
import { notFoundHandler } from "./shared/middleware/notFound.middleware.js";
import { configureSwagger } from "./shared/swagger/swagger.js";

import categoryRoutes from "./api/v1/categories/category.routes.js";
import {
  countryRouter,
  districtRouter,
  stateRouter
} from "./api/v1/locations/location.routes.js";
import masterDataRoutes from "./api/v1/master-data/master-data.routes.js";
import mediaRoutes from "./api/v1/media/media.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log("Incoming request:", req.method, req.originalUrl);
    next();
  });
}

app.get("/", (_req: any, res: any) => {
  res.json({
    success: true,
    message: "API is running successfully!"
  });
});

app.use("/api/v1/categories", categoryRoutes);

app.use("/api/v1/countries", countryRouter);

app.use("/api/v1/states", stateRouter);

app.use("/api/v1/districts", districtRouter);

app.use("/api/v1/media", mediaRoutes);

app.use("/api/v1/news", newsRoutes);

app.use("/api/v1/master-data", masterDataRoutes);

console.log("Registering News Reads routes at /api/v1/news-reads");
/**
 * News Reads
 *
 * POST /api/news-reads
 * GET  /api/news-reads/news/:id/count
 * GET  /api/news-reads/popular
 */
app.use("/api/v1/news-reads", newsReadsRoutes);

configureSwagger(app);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
