import jwt from "jsonwebtoken";

export function signToken(userId, secret) {
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn: "30d" });
}

export function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return res.status(401).json({ error: "Please log in." });
  try {
    req.userId = jwt.verify(m[1], req.app.locals.config.jwtSecret).sub;
    next();
  } catch {
    res.status(401).json({ error: "Your login has expired. Please log in again." });
  }
}
