import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ...err.extra, error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Données invalides", details: err.flatten() });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Erreur interne" });
};
