/**
 * Builds the webmux binary using `bun build --compile`.
 *
 * Output:
 *   dist/webmux - Single compiled ELF binary
 */

import path from "path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  console.log("Compiling webmux binary...");

  const result = await Bun.build({
    entrypoints: [path.join(PROJECT_ROOT, "src/server/index.ts")],
    target: "bun",
    minify: true,
    sourcemap: "linked",
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
