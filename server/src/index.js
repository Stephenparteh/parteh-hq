import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";

const { MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, INVITE_CODE, PORT = 4000 } = process.env;

async function start() {
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    console.error("JWT_SECRET is missing or too short. Set a long random string in server/.env.");
    process.exit(1);
  }
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. See the README to create the Atlas database.");
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected");
  } catch (e) {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  }
  if (!CLIENT_ORIGIN) console.warn("CLIENT_ORIGIN is not set. Browsers on other origins will be blocked by CORS.");
  const app = createApp({ jwtSecret: JWT_SECRET, inviteCode: INVITE_CODE, clientOrigin: CLIENT_ORIGIN });
  app.listen(PORT, () => console.log(`parteh-hq-api listening on port ${PORT}`));
}
start();
