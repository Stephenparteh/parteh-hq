// Validates req.body with a zod schema and replaces it with the parsed value.
export const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    const msgs = r.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    return res.status(400).json({ error: msgs.join(" "), details: msgs });
  }
  req.body = r.data;
  next();
};
