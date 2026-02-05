/**
 * Authentication middleware for Webmux.
 * Verifies JWT tokens from HTTP-only cookies.
 */

import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";

export const AUTH_COOKIE_NAME = "webmux_auth";

/**
 * Creates middleware that verifies the JWT token from the auth cookie.
 * Returns 401 Unauthorized if the token is missing or invalid.
 */
export function createAuthMiddleware(jwtSecret: string) {
  return createMiddleware(async (c, next) => {
    const token = getCookie(c, AUTH_COOKIE_NAME);

    if (!token) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      const payload = await verify(token, jwtSecret, "HS256");

      // Check expiration (verify should handle this, but be explicit)
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return c.json({ error: "Token expired" }, 401);
      }

      await next();
    } catch {
      return c.json({ error: "Invalid token" }, 401);
    }
  });
}
