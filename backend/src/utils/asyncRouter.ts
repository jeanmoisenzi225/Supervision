import { Router, type RequestHandler } from "express";

/**
 * Router dont les gestionnaires async renvoient leurs erreurs à
 * errorHandler (Express 4 ne le fait pas tout seul).
 */
export function asyncRouter(): Router {
  const router = Router();
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const original = router[method].bind(router) as (...args: unknown[]) => Router;
    (router as unknown as Record<string, unknown>)[method] = (path: unknown, ...handlers: RequestHandler[]) =>
      original(
        path,
        ...handlers.map(
          (h): RequestHandler =>
            (req, res, next) => {
              Promise.resolve(h(req, res, next)).catch(next);
            }
        )
      );
  }
  return router;
}
