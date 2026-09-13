/**
 * e2e tests need a real, reachable MongoDB (Better Auth + Mongoose both
 * connect for real — no in-memory server is used, by design: point
 * TEST_MONGODB_URI at a disposable test cluster/database, never production).
 * When it isn't set, DB-dependent e2e suites are skipped rather than failed.
 */
export const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI;

export function useTestDatabase(): void {
  if (TEST_MONGODB_URI) {
    process.env.MONGODB_URI = TEST_MONGODB_URI;
  }
}

export function uniqueTestEmail(): string {
  return `guardian-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}
