import { ApiReference } from "@scalar/api-reference";
import type { Express, RequestHandler } from "express";
import fs from "node:fs";
import path from "node:path";

export const configureSwagger = (app: Express): void => {
  const openApiPath = path.join(process.cwd(), "docs", "openapi.yaml");

  const specification = fs.readFileSync(openApiPath, "utf8");

  app.use(
    "/api-docs",
    ApiReference as unknown as RequestHandler
  );
};
