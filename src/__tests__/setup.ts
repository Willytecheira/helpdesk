// Setup compartido para Vitest.
// AUTH_SECRET es requerido por src/lib/crypto.ts.
process.env.AUTH_SECRET ??=
  "test-auth-secret-only-used-for-unit-tests-32-bytes-long-please"
