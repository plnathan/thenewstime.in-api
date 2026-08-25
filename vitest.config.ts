import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,

    environment: "node",

    setupFiles: "./src/shared/tests/setup.ts",

    include: ["src/api/v1/**/tests/**/*.test.ts"],

    coverage: {
      provider: "v8",

      reporter: ["text", "html"],

      reportsDirectory: "./coverage"
    }
  }
});
