/**
 * Static file serving for Webmux.
 *
 * In production (compiled binary), serves files embedded in the binary.
 * In development, falls back to serving from the filesystem.
 */

import type { Context, Next } from "hono";
import { serveStatic } from "hono/bun";
import path from "path";

// Try to import embedded assets (only exists after build)
let embeddedAssets: typeof import("./embedded.js") | null = null;
try {
  embeddedAssets = await import("./embedded.js");
} catch {
  // Not in production build, will use filesystem serving
}

const DIST_CLIENT = path.resolve(import.meta.dirname, "../../../dist/client");

/**
 * Serves static files from either embedded assets (production) or
 * filesystem (development).
 */
export function createStaticMiddleware() {
  if (embeddedAssets) {
    // Production: serve from embedded assets
    return async (c: Context, next: Next) => {
      let urlPath = new URL(c.req.url).pathname;

      // Try the exact path first
      let asset = embeddedAssets!.getEmbeddedAsset(urlPath);

      // If not found, try index.html for SPA routing
      if (!asset) {
        asset = embeddedAssets!.getEmbeddedAsset("/index.html");
      }

      if (asset) {
        const file = asset.file();
        const content = await file.arrayBuffer();
        return new Response(content, {
          headers: {
            "Content-Type": asset.mimeType,
            "Cache-Control": urlPath.startsWith("/assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          },
        });
      }

      await next();
    };
  } else {
    // Development: serve from filesystem using Hono's serveStatic
    const staticHandler = serveStatic({ root: DIST_CLIENT });
    const fallbackHandler = serveStatic({ root: DIST_CLIENT, path: "index.html" });

    return async (c: Context, next: Next) => {
      // Try to serve the static file
      const response = await staticHandler(c, async () => {});

      if (response) {
        return response;
      }

      // Fallback to index.html for SPA routing
      return fallbackHandler(c, next);
    };
  }
}
