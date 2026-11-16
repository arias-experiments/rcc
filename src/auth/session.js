import { createHash, randomBytes } from "node:crypto";
import { pool } from "../db/pool.js";

export const SESSION_COOKIE_NAME = "rcc_session";
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    };
}

export async function createSession(userId, database = pool) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    await database.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [userId, hashSessionToken(token), expiresAt]
    );

    return { token, expiresAt };
}

export function setSessionCookie(res, session) {
    res.cookie(SESSION_COOKIE_NAME, session.token, {
        ...cookieOptions(),
        maxAge: Math.max(0, session.expiresAt.getTime() - Date.now())
    });
}

export function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
}

export function safeUser(user) {
    // pg returns BIGINT as a string to preserve precision.
    return { id: user.id, username: user.username, displayName: user.display_name };
}
