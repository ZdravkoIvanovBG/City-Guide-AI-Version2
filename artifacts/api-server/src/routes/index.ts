import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import citiesRouter from "./cities";
import plansRouter from "./plans";
import profileRouter from "./profile";
import weatherRouter from "./weather";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(citiesRouter);
router.use(plansRouter);
router.use(profileRouter);
router.use(weatherRouter);

export default router;
