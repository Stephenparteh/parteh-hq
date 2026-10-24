export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (_req, res) => res.status(404).json({ error: "Not found" });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "The request body is not valid JSON." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
}
