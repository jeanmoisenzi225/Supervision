import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test", JWT_SECRET: "test", MONITOR_ENABLED: "false" },
  },
});
