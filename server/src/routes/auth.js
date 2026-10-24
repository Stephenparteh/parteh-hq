import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/index.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";

const email = z.string({ error: "Email is required." }).trim().toLowerCase().email("Enter a valid email address.");
const registerSchema = z.object({
  email,
  password: z.string({ error: "Password is required." }).min(8, "Password must be at least 8 characters.").max(200, "Password is too long."),
  inviteCode: z.string().optional(),
});
const loginSchema = z.object({ email, password: z.string({ error: "Password is required." }).min(1, "Password is required.") });

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
const userOut = (u) => ({ id: String(u._id), email: u.email });

export function authRouter(limiter) {
  const r = Router();

  r.post("/auth/register", limiter, validate(registerSchema), async (req, res) => {
    const { inviteCode: required } = req.app.locals.config;
    const { email, password, inviteCode } = req.body;
    // Open only while there are no users. After that an invite code from .env is needed.
    if ((await User.countDocuments()) > 0) {
      if (!required) throw new HttpError(403, "Registration is closed.");
      if (!inviteCode || !sameSecret(inviteCode, required)) throw new HttpError(403, "Registration is closed. A valid invite code is needed.");
    }
    if (await User.exists({ email })) throw new HttpError(409, "That email is already registered.");
    let user;
    try {
      user = await User.create({ email, passwordHash: await bcrypt.hash(password, 10) });
    } catch (e) {
      if (e.code === 11000) throw new HttpError(409, "That email is already registered.");
      throw e;
    }
    res.status(201).json({ token: signToken(user._id, req.app.locals.config.jwtSecret), user: userOut(user) });
  });

  r.post("/auth/login", limiter, validate(loginSchema), async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) throw new HttpError(401, "Wrong email or password.");
    res.json({ token: signToken(user._id, req.app.locals.config.jwtSecret), user: userOut(user) });
  });

  r.get("/me", requireAuth, async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw new HttpError(401, "Please log in again.");
    res.json({ user: userOut(user) });
  });

  return r;
}
