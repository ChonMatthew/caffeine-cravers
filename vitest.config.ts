import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()], // resolve @/ imports in tests
  test: {
    environment: "node", // pure functions, no DOM needed
  },
});
