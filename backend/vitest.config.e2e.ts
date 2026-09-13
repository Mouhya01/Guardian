import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Several suites bootstrap a real MongoDB connection (Atlas SRV lookup + TLS
    // handshake) plus a Better Auth sign-up per test — generous margin over the
    // 5s/10s defaults.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
