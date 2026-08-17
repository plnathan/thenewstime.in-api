import { Router } from "express";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import * as controller from "./location.controller.js";

import {
  districtsQuerySchema,
  statesQuerySchema
} from "./location.validation.js";

export const countryRouter = Router();

countryRouter.get("/", controller.getCountries);

export const stateRouter = Router();

stateRouter.get(
  "/",
  validate(statesQuerySchema, "query"),
  controller.getStates
);

export const districtRouter = Router();

districtRouter.get(
  "/",
  validate(districtsQuerySchema, "query"),
  controller.getDistricts
);
