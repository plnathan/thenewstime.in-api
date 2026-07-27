import type { Express } from "express";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

export const configureSwagger = (app: Express): void => {
  const swaggerPath = path.join(process.cwd(), "docs", "openapi.yaml");

  const swaggerDocument = YAML.load(swaggerPath);

  //console.log(`Swagger Path: ${swaggerPath}`);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
