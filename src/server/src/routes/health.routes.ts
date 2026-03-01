import { Router } from "express";

const router = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

router.get("/readyz", (_req, res) => {
  res.json({ status: "ready", timestamp: new Date().toISOString() });
});

export default router;
