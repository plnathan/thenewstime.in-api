import maintenanceRoutes from "./api/v1/system/maintenance.routes.js";
import { publicMaintenanceMiddleware } from "./shared/middleware/maintenance.middleware.js";
import dashboardRoutes from "./api/v1/dashboard/dashboard.routes.js";
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
import authRoutes from "./api/v1/security/auth/auth.routes.js";
import permissionRoutes from "./api/v1/security/permissions/permission.routes.js";
import roleRoutes from "./api/v1/security/roles/role.routes.js";
import userRoutes from "./api/v1/security/users/user.routes.js";

import { pool } from "./shared/config/db.js";
import { createAdvertisementEnquiryAdminRouter } from "./api/v1/advertisements/advertisement-enquiries/advertisement-enquiry.admin.routes.js";
import { createAdvertisementEnquiryRouter } from "./api/v1/advertisements/advertisement-enquiries/advertisement-enquiry.routes.js";

import advertisementRoutes from "./api/v1/advertisements/advertisement/advertisement.routes.js";
import advertisementClientRoutes from "./api/v1/advertisements/clients/client.routes.js";
import placementRoutes from "./api/v1/advertisements/placements/placement.routes.js";
import advertisementTrackingRoutes from "./api/v1/advertisements/tracking/tracking.routes.js";
import cloudinaryCleanupCronRoutes from "./api/v1/system/cloudinary-cleanup-cron.routes.js";

const app = express();

app.use(cors());
app.use(express.json());
// Vercel is a trusted single reverse-proxy hop; avoid trusting arbitrary client XFF.
if (process.env.VERCEL === "1") app.set("trust proxy", 1);

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

app.get("/api/v1/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ success: true, status: "UP" });
});

app.use("/api/v1/system", maintenanceRoutes);

app.use(publicMaintenanceMiddleware);

app.use(
  "/api/v1/advertisement-enquiries/admin",
  createAdvertisementEnquiryAdminRouter(pool)
);

app.use(
  "/api/v1/advertisement-enquiries",
  createAdvertisementEnquiryRouter(pool)
);

app.use("/api/v1/advertisements/placements", placementRoutes);

app.use("/api/v1/advertisements/tracking", advertisementTrackingRoutes);

app.use("/api/v1/advertisements", advertisementRoutes);

app.use("/api/v1/advertisement-clients", advertisementClientRoutes);

app.use("/api/v1/dashboard", dashboardRoutes);

app.use("/api/v1/categories", categoryRoutes);

app.use("/api/v1/countries", countryRouter);

app.use("/api/v1/states", stateRouter);

app.use("/api/v1/districts", districtRouter);

app.use("/api/v1/media", mediaRoutes);

app.use("/api/v1/news", newsRoutes);

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/security/roles", roleRoutes);

app.use("/api/v1/security/permissions", permissionRoutes);

app.use("/api/v1/security/users", userRoutes);

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

app.use("/api/v1/system/cloudinary-cleanup", cloudinaryCleanupCronRoutes);

configureSwagger(app);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
