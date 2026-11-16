import express from "express";
import { pool } from "../db/pool.js";
import { DUMMY_PASSWORD_HASH, hashPassword, isValidPassword, verifyPassword } from "../auth/password.js";
import {
    clearSessionCookie, createSession, hashSessionToken, safeUser,
    SESSION_COOKIE_NAME, setSessionCookie
} from "../auth/session.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

function normalizedUsername(username) {
    return typeof username === "string" ? username.toLowerCase() : "";
}

function validUsername(username) {
    return /^[a-z0-9._-]{3,50}$/.test(username);
}

router.post("/register", async (req, res) => {
    const { username: inputUsername, displayName, password } = req.body ?? {};
    const username = normalizedUsername(inputUsername);

    if (!validUsername(username)) {
        return res.status(400).json({ error: "Username must contain 3 to 50 letters, numbers, dots, underscores, or hyphens" });
    }
    if (typeof displayName !== "string" || !displayName.trim()
        || Array.from(displayName).length > 100) {
        return res.status(400).json({ error: "Display name must contain 1 to 100 characters" });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ error: "Password must contain at least 10 characters and at most 72 UTF-8 bytes" });
    }

    let client;
    try {
        const passwordHash = await hashPassword(password);
        client = await pool.connect();
        await client.query("BEGIN");
        const result = await client.query(
            `INSERT INTO users (username, display_name, password_hash)
             VALUES ($1, $2, $3) RETURNING id, username, display_name`,
            [username, displayName, passwordHash]
        );
        const user = result.rows[0];
        const session = await createSession(user.id, client);
        await client.query("COMMIT");
        setSessionCookie(res, session);
        return res.status(201).json(safeUser(user));
    } catch (error) {
        if (client) {
            try { await client.query("ROLLBACK"); } catch { /* Preserve a generic response. */ }
        }
        if (error.code === "23505" && error.constraint === "users_username_key") {
            return res.status(409).json({ error: "Username already exists" });
        }
        return res.status(500).json({ error: "Unable to register user" });
    } finally {
        client?.release();
    }
});

router.post("/login", async (req, res) => {
    const { username: inputUsername, password } = req.body ?? {};
    const username = normalizedUsername(inputUsername);
    const invalidCredentials = () => res.status(401).json({ error: "Invalid username or password" });

    if (!validUsername(username) || !isValidPassword(password)) {
        return invalidCredentials();
    }

    try {
        const result = await pool.query(
            "SELECT id, username, display_name, password_hash FROM users WHERE username = $1",
            [username]
        );
        const user = result.rows[0];
        const matches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
        if (!user || !matches) {
            return invalidCredentials();
        }

        const session = await createSession(user.id);
        setSessionCookie(res, session);
        return res.status(200).json(safeUser(user));
    } catch {
        return res.status(500).json({ error: "Unable to log in" });
    }
});

router.post("/logout", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    clearSessionCookie(res);

    try {
        if (typeof token === "string" && token) {
            await pool.query("DELETE FROM user_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
        }
        return res.status(204).end();
    } catch {
        return res.status(500).json({ error: "Unable to log out" });
    }
});

router.get("/me", requireAuth, (req, res) => res.json(req.user));

export default router;
