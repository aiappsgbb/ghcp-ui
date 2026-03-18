import type { Request, Response, NextFunction } from "express";

/**
 * EasyAuth identity middleware.
 * Extracts user identity from Azure Container Apps EasyAuth headers.
 * Falls back to "default" in development (no EasyAuth).
 */

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userName: string;
    }
  }
}

export function easyAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // EasyAuth injects these headers after authentication
  const principalId = req.headers["x-ms-client-principal-id"] as string | undefined;
  const principalName = req.headers["x-ms-client-principal-name"] as string | undefined;

  req.userId = principalId ?? "default";
  req.userName = principalName ?? "Anonymous";

  next();
}
