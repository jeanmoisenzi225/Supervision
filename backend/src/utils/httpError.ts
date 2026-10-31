export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Champs ajoutés à la réponse (ex. totpRequired). */
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}
