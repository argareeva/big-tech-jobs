import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use((req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});
router.use(jobsRouter);

export default router;
