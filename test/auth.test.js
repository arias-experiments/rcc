import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { hashSessionToken, SESSION_LIFETIME_MS } from "../src/auth/session.js";

// Uses the configured PostgreSQL database; creates and cleans up only unique test users.
test("authentication with real PostgreSQL sessions", async (t) => {
    const username = `auth_test_${randomBytes(8).toString("hex")}`;
    const password = "Integration password 123!";
    const server = app.listen(0, "127.0.0.1");
    let cookie;
    let user;
    const initialNodeEnv = process.env.NODE_ENV;

    t.after(async () => {
        if (initialNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = initialNodeEnv;
        try {
            await pool.query("DELETE FROM users WHERE username = $1", [username]);
        } finally {
            await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
            await pool.end();
        }
    });

    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(path, { method = "GET", body, sessionCookie } = {}) {
        const response = await fetch(`${base}${path}`, {
            method,
            headers: {
                ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                ...(sessionCookie ? { Cookie: sessionCookie } : {})
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await response.text();
        return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
    }
    const credentials = { username, password };

    await t.test("malformed and oversized auth JSON returns safe errors", async () => {
        for (const [body, status, error] of [
            ['{"password": "sensitive value",', 400, "Invalid request body"],
            [JSON.stringify({ password: "x".repeat(110000) }), 413, "Request body too large"]
        ]) {
            const response = await fetch(`${base}/api/auth/register`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body
            });
            assert.equal(response.status, status);
            assert.deepEqual(await response.json(), { error });
        }
    });

    await t.test("Phase 1 root and database health still work", async () => {
        const root = await request("/");
        assert.equal(root.status, 200);
        assert.deepEqual(root.body, { name: "RCC API", status: "running" });
        const health = await request("/api/health");
        assert.equal(health.status, 200);
        assert.equal(health.body.database, "connected");
    });

    await t.test("registration validates usernames, display names, and UTF-8 password limits", async () => {
        const valid = { ...credentials, displayName: "Test User" };
        for (const change of [
            { username: "ab" }, { username: "a".repeat(51) }, { username: "bad name" },
            { username: "x'; DROP TABLE users;--" }, { username: {} },
            { displayName: "" }, { displayName: "   " }, { displayName: "x".repeat(101) },
            { password: "123456789" }, { password: "a".repeat(73) },
            { password: "é".repeat(37) }, { password: "😀".repeat(9) }, { password: 1234567890 }
        ]) {
            const response = await request("/api/auth/register", { method: "POST", body: { ...valid, ...change } });
            assert.equal(response.status, 400);
            assert.equal(response.headers.get("set-cookie"), null);
        }
    });

    await t.test("1. registration normalizes username, returns safe user, and logs in", async () => {
        process.env.NODE_ENV = "development";
        const response = await request("/api/auth/register", {
            method: "POST", body: { ...credentials, username: username.toUpperCase(), displayName: "Test User" }
        });
        assert.equal(response.status, 201);
        user = response.body;
        assert.deepEqual(Object.keys(user).sort(), ["displayName", "id", "username"]);
        assert.equal(user.username, username);
        assert.equal(user.displayName, "Test User");
        const setCookie = response.headers.get("set-cookie");
        assert.match(setCookie, /HttpOnly/i);
        assert.match(setCookie, /SameSite=Lax/i);
        assert.match(setCookie, /Path=\//i);
        assert.match(setCookie, /Max-Age=60479[89]|Max-Age=604800/);
        assert.doesNotMatch(setCookie, /; Secure/i);
        assert.equal(response.headers.get("cache-control"), "no-store");
        cookie = setCookie.split(";")[0];
        assert.deepEqual((await request("/api/auth/me", { sessionCookie: cookie })).body, user);
    });
    assert.ok(user && cookie, "Registration must succeed before dependent checks run");

    await t.test("2. PostgreSQL stores a cost-12 bcrypt password hash", async () => {
        const { rows: [stored] } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
        assert.match(stored.password_hash, /^\$2[ab]\$12\$/);
        assert.notEqual(stored.password_hash, password);
        assert.equal(await bcrypt.compare(password, stored.password_hash), true);
    });

    await t.test("3. duplicate normalized username returns 409", async () => {
        const response = await request("/api/auth/register", {
            method: "POST", body: { ...credentials, username: username.toUpperCase(), displayName: "Duplicate" }
        });
        assert.equal(response.status, 409);
        assert.equal(response.headers.get("set-cookie"), null);
    });

    let wrongPasswordResponse;
    await t.test("5. wrong password returns generic 401", async () => {
        wrongPasswordResponse = await request("/api/auth/login", {
            method: "POST", body: { ...credentials, password: "Wrong password 123!" }
        });
        assert.equal(wrongPasswordResponse.status, 401);
        assert.deepEqual(wrongPasswordResponse.body, { error: "Invalid username or password" });
        assert.equal(wrongPasswordResponse.headers.get("set-cookie"), null);
    });

    await t.test("6. nonexistent username returns identical 401", async () => {
        const response = await request("/api/auth/login", {
            method: "POST", body: { ...credentials, username: `${username}_missing` }
        });
        assert.equal(response.status, wrongPasswordResponse.status);
        assert.deepEqual(response.body, wrongPasswordResponse.body);
        assert.equal(response.headers.get("set-cookie"), null);
    });

    await t.test("4. login normalizes username and creates a fresh secure cookie in production", async () => {
        process.env.NODE_ENV = "production";
        const response = await request("/api/auth/login", {
            method: "POST", body: { ...credentials, username: username.toUpperCase() }
        });
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, user);
        assert.match(response.headers.get("set-cookie"), /; Secure/i);
        const loginCookie = response.headers.get("set-cookie").split(";")[0];
        assert.notEqual(loginCookie, cookie);
        cookie = loginCookie;
        process.env.NODE_ENV = "development";
    });

    await t.test("7. authenticated me returns only safe user fields", async () => {
        const response = await request("/api/auth/me", { sessionCookie: cookie });
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, user);
    });

    await t.test("8. missing, invalid, or malformed cookie returns 401", async () => {
        for (const sessionCookie of [undefined, "rcc_session=invalid", "rcc_session=j%3A%7B%7D"]) {
            assert.equal((await request("/api/auth/me", { sessionCookie })).status, 401);
        }
    });

    await t.test("11. database sessions contain only SHA-256 hashes with seven-day expiry", async () => {
        const { rows } = await pool.query("SELECT * FROM user_sessions WHERE user_id = $1", [user.id]);
        assert.equal(rows.length, 2);
        const token = cookie.slice("rcc_session=".length);
        assert.match(token, /^[a-f0-9]{64}$/);
        for (const session of rows) {
            assert.match(session.token_hash, /^[a-f0-9]{64}$/);
            assert.notEqual(session.token_hash, token);
            assert.ok(Math.abs(session.expires_at - session.created_at - SESSION_LIFETIME_MS) < 5000);
        }
        assert.equal(rows.filter((row) => row.token_hash === hashSessionToken(token)).length, 1);
        assert.equal(JSON.stringify(rows).includes(token), false);
    });

    await t.test("9. logout deletes the database session and clears the cookie", async () => {
        const response = await request("/api/auth/logout", { method: "POST", sessionCookie: cookie });
        assert.equal(response.status, 204);
        assert.match(response.headers.get("set-cookie"), /rcc_session=;/);
        const result = await pool.query("SELECT id FROM user_sessions WHERE token_hash = $1", [hashSessionToken(cookie.slice(12))]);
        assert.equal(result.rowCount, 0);
    });

    await t.test("10. replaying a logged-out token returns 401", async () => {
        assert.equal((await request("/api/auth/me", { sessionCookie: cookie })).status, 401);
    });

    await t.test("logout is idempotent for missing, invalid, and already-revoked cookies", async () => {
        for (const sessionCookie of [undefined, "rcc_session=invalid", "rcc_session=j%3A%7B%7D", cookie]) {
            assert.equal((await request("/api/auth/logout", { method: "POST", sessionCookie })).status, 204);
        }
    });

    await t.test("expired database session cannot authenticate", async () => {
        const response = await request("/api/auth/login", { method: "POST", body: credentials });
        assert.equal(response.status, 200);
        cookie = response.headers.get("set-cookie").split(";")[0];
        await pool.query("UPDATE user_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1", [hashSessionToken(cookie.slice(12))]);
        assert.equal((await request("/api/auth/me", { sessionCookie: cookie })).status, 401);
    });

    await t.test("72-byte Unicode password boundary is accepted", async () => {
        const boundaryPassword = "é".repeat(36);
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(boundaryPassword, 12), user.id]);
        const response = await request("/api/auth/login", { method: "POST", body: { username, password: boundaryPassword } });
        assert.equal(response.status, 200);
        cookie = response.headers.get("set-cookie").split(";")[0];
    });

    await t.test("12. deleting a user cascades to sessions and prevents authentication", async () => {
        assert.ok((await pool.query("SELECT id FROM user_sessions WHERE user_id = $1", [user.id])).rowCount > 0);
        await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
        assert.equal((await pool.query("SELECT id FROM user_sessions WHERE user_id = $1", [user.id])).rowCount, 0);
        assert.equal((await request("/api/auth/me", { sessionCookie: cookie })).status, 401);
    });
});
