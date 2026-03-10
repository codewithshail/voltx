// @voltx/cli — CLI utilities and programmatic API

export { createProject, type CreateProjectOptions } from "./create.js";
export { runDev, type DevOptions } from "./dev.js";
export { runBuild, type BuildOptions } from "./build.js";
export { runStart, type StartOptions } from "./start.js";
export { runGenerate, type GenerateOptions, type GeneratorType } from "./generate.js";

export const CLI_VERSION = "0.3.6";
