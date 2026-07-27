import type { Express } from "express";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import fs from "node:fs";

export const configureSwagger = (app: Express): void => {
  const swaggerPath = path.join(process.cwd(), "docs", "openapi.yaml");

  console.log("cwd =", process.cwd());
  console.log("swaggerPath =", swaggerPath);
  console.log("exists =", fs.existsSync(swaggerPath));

  const swaggerDocument = YAML.load(swaggerPath);

  //console.log(`Swagger Path: ${swaggerPath}`);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
