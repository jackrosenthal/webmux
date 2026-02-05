/**
 * Authentication routes for Webmux.
 * Handles login with JWT tokens stored in HTTP-only cookies.
 */

import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { timingSafeEqual } from "crypto";
import type { WebmuxConfig } from "../../shared/config.js";
import { AUTH_COOKIE_NAME } from "./middleware.js";

/**
 * Generates a cryptographically secure random secret for JWT signing.
 * Called once at server startup.
 */
export function generateJwtSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);

  if (aBytes.length !== bBytes.length) {
    // Compare against self to maintain constant time, then return false
    timingSafeEqual(aBytes, aBytes);
    return false;
  }

  return timingSafeEqual(aBytes, bBytes);
}

export function createAuthRoutes(config: WebmuxConfig, jwtSecret: string) {
  const auth = new Hono();

  auth.post("/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      password?: string;
    };
    const password = body.password;

    if (typeof password !== "string") {
      return c.json({ error: "Password is required" }, 400);
    }

    if (!timingSafeCompare(password, config.auth.password)) {
      return c.json({ error: "Invalid password" }, 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = config.auth.token_validity_days * 24 * 60 * 60;

    const token = await sign(
      {
        iat: now,
        exp: now + expiresIn,
      },
      jwtSecret
    );

    setCookie(c, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: expiresIn,
    });

    return c.json({ success: true });
  });

  auth.get("/verify", async (c) => {
    const token = getCookie(c, AUTH_COOKIE_NAME);

    if (!token) {
      return c.json({ authenticated: false }, 401);
    }

    try {
      const payload = await verify(token, jwtSecret, "HS256");

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return c.json({ authenticated: false }, 401);
      }

      return c.json({ authenticated: true });
    } catch {
      return c.json({ authenticated: false }, 401);
    }
  });

  auth.post("/logout", (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME, {
      path: "/",
    });

    return c.json({ success: true });
  });

  return auth;
}
