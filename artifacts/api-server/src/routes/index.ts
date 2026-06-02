import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import citiesRouter from "./cities";
import plansRouter from "./plans";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(citiesRouter);
router.use(plansRouter);
router.use(profileRouter);

export default router;
