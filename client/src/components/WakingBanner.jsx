import { useSyncExternalStore } from "react";
import { subscribeSlow, isSlow } from "../api.js";

// Render's free plan sleeps, so the first request can take up to a minute.
export default function WakingBanner() {
  const slow = useSyncExternalStore(subscribeSlow, isSlow);
  return slow ? <div className="waking" role="status">Waking up the server… this can take up to a minute.</div> : null;
}
