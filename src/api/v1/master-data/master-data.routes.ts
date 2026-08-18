import { Router } from "express";

import * as controller from "./master-data.controller.js";

const router = Router();

router.get("/categories", controller.getCategories);

router.get("/countries", controller.getCountries);

router.get("/states", controller.getStates);

router.get("/districts", controller.getDistricts);

export default router;
