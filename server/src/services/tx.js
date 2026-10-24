import mongoose from "mongoose";

// Transactions need a replica set (Atlas always is, even on the free plan). A plain standalone
// mongod, like the default test database, can't do them.
export function supportsTransactions() {
  const type = mongoose.connection.getClient?.()?.topology?.description?.type;
  return type === "ReplicaSetWithPrimary" || type === "Sharded" || type === "LoadBalanced";
}

/**
 * Runs fn(session). With a session, all writes made with it commit together or not at all.
 * Without transaction support, fn(null) runs and the caller must undo its own writes on failure.
 */
export async function atomically(fn) {
  if (!supportsTransactions()) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}
