import express from "express";
import cors from "cors";
//import routes from "./routes/index.js";
import { notFoundHandler } from "./shared/middleware/notFound.middleware.js";
import { errorHandler } from "./shared/middleware/error.middleware.js";
import newsRoutes from "./api/v1/news/news.routes.js";
import { configureSwagger } from "./shared/swagger/swagger.js";

const app = express();

app.use(cors());
app.use(express.json());
//app.use(express.urlencoded({ extended: true }));

// app.use((req, _res, next) => {
//   console.log("Incoming request:", req.method, req.originalUrl);
//   next();
// });

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log("Incoming request:", req.method, req.originalUrl);
    next();
  });
}

app.get("/", (_req: any, res: any) => {
  res.json({ success: true, message: "API is running successfully!" });
});

//app.use("/api", routes);
app.use("/api/v1/news", newsRoutes);

configureSwagger(app);

app.use(notFoundHandler);
app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// app.get("/api/news", (_req, res) => {
//   res.json([
//     { id: 1, title: "News 1" },
//     { id: 2, title: "News 2" }
//   ]);
// });

export default app;
