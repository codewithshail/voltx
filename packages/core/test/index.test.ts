import { describe, it, expect } from "vitest";
import { createLogger, defineConfig, createApp, VoltxApp } from "../src/index.js";

describe("core", () => {
  describe("createLogger", () => {
    it("returns a logger with all levels", () => {
      const logger = createLogger("test");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });

  describe("defineConfig", () => {
    it("merges with defaults", () => {
      const config = defineConfig({ name: "my-app" });
      expect(config.name).toBe("my-app");
      expect(config.port).toBe(3000);
    });

    it("accepts partial config", () => {
      const config = defineConfig({});
      expect(config.name).toBe("voltx-app");
      expect(config.port).toBe(3000);
    });
  });

  describe("createApp", () => {
    it("creates a VoltxApp instance", () => {
      const app = createApp({ name: "test-app" });
      expect(app).toBeInstanceOf(VoltxApp);
      expect(app.config.name).toBe("test-app");
    });

    it("is not running initially", () => {
      const app = createApp();
      expect(app.isRunning()).toBe(false);
    });

    it("allows plugin registration", () => {
      const app = createApp();
      const plugin = { name: "test", setup: () => {} };
      app.use(plugin);
      // No error thrown
      expect(true).toBe(true);
    });
  });
});
