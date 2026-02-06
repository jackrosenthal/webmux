/**
 * Builds the webmux binary using `bun build --compile`.
 *
 * This script uses a Bun plugin to patch node-pty's dynamic loader so that
 * it uses a static require that Bun can trace and embed in the compiled
 * binary.
 *
 * Output:
 *   dist/webmux - Single compiled ELF binary with embedded native module
 */

import path from "path";
import type { BunPlugin } from "bun";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const NODE_PTY_PATH = path.join(
  PROJECT_ROOT,
  "node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty"
);

/**
 * Plugin that patches node-pty's utils.js to use a static require for
 * the native module, allowing Bun to embed it in compiled binaries.
 */
const nodePtyPlugin: BunPlugin = {
  name: "node-pty-static-loader",
  setup(build) {
    // Intercept node-pty/lib/utils.js and replace the dynamic loader
    build.onLoad(
      { filter: /node-pty[\/\\]lib[\/\\]utils\.js$/ },
      async (args) => {
        // Return a patched version that uses static require
        const nativeModulePath = path.join(
          NODE_PTY_PATH,
          "build/Release/pty.node"
        );

        return {
          contents: `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadNativeModule = exports.assign = void 0;

function assign(target) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function (source) { return Object.keys(source).forEach(function (key) { return target[key] = source[key]; }); });
    return target;
}
exports.assign = assign;

// Patched loader: uses static require so Bun can embed the native module
function loadNativeModule(name) {
    // Static require that Bun can trace at bundle time
    var module = require(${JSON.stringify(nativeModulePath)});
    return { dir: ${JSON.stringify(path.join(NODE_PTY_PATH, "build/Release"))}, module: module };
}
exports.loadNativeModule = loadNativeModule;
`,
          loader: "js",
        };
      }
    );
  },
};

async function main() {
  console.log("Compiling webmux binary with embedded native modules...");

  const result = await Bun.build({
    entrypoints: [path.join(PROJECT_ROOT, "src/server/index.ts")],
    target: "bun",
    minify: true,
    sourcemap: "linked",
    plugins: [nodePtyPlugin],
    // @ts-expect-error - compile option exists but may not be in types
    compile: {
      outfile: path.join(PROJECT_ROOT, "dist/webmux"),
    },
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log("");
  console.log("Build complete!");
  console.log("");
  console.log("Output: dist/webmux");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
