import { Router, type IRouter } from "express";
import healthRouter from "./health";
import settingsRouter from "./settings";
import filesRouter from "./files";

const router: IRouter = Router();

router.use(healthRouter);
router.use(settingsRouter);
router.use(filesRouter);

export default router;
