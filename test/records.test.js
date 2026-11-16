import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import app from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { validateRecord } from "../src/validation/record.js";

test("authenticated records with real PostgreSQL ownership isolation", async (t) => {
    const prefix = `records_test_${randomBytes(8).toString("hex")}`;
    const usernames = [`${prefix}_a`, `${prefix}_b`];
    const server = app.listen(0, "127.0.0.1");
    const actors = [];
    let record;
    const complete = {
        recordedAt: "2026-11-13T17:45:00.000Z",
        glicemia: 97, cetonemia: 0.7, horasAyuno: 14,
        dolor: 2, anergia: 3, fatiga: 2, inatencion: 3,
        estres: 2, somnolencia: 2, insomnio: 1, comentario: "Integration test"
    };
    const responseKeys = ["id", ...Object.keys(complete), "createdAt", "updatedAt"].sort();

    t.after(async () => {
        try {
            // ON DELETE CASCADE removes this suite's sessions and records too.
            await pool.query("DELETE FROM users WHERE username = ANY($1::text[])", [usernames]);
        } finally {
            await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
            await pool.end();
        }
    });
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;

    function assertSafeRecord(value) {
        assert.deepEqual(Object.keys(value).sort(), responseKeys);
        for (const actor of actors) assert.equal(JSON.stringify(value).includes(actor.cookie.slice(12)), false);
    }
    async function request(method, path = "", body, actor = actors[0]) {
        const response = await fetch(`${base}/api/records${path}`, {
            method,
            headers: {
                ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                ...(actor ? { Cookie: actor.cookie } : {})
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await response.text();
        const json = text ? JSON.parse(text) : null;
        if (response.ok && json) {
            for (const value of Array.isArray(json) ? json : [json]) assertSafeRecord(value);
            assert.equal(response.headers.get("cache-control"), "no-store");
        }
        return { status: response.status, body: json };
    }
    for (const username of usernames) {
        const response = await fetch(`${base}/api/auth/register`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, displayName: "Records Test", password: "Records test password 123!" })
        });
        assert.equal(response.status, 201, "Test user registration must succeed");
        actors.push({ ...await response.json(), cookie: response.headers.get("set-cookie").split(";")[0] });
    }

    await t.test("1. all six record endpoints require authentication", async () => {
        for (const [method, path, body] of [
            ["GET", ""], ["GET", "/1"], ["POST", "", complete],
            ["PUT", "/1", complete], ["PATCH", "/1", { dolor: 1 }], ["DELETE", "/1"]
        ]) assert.equal((await request(method, path, body, null)).status, 401);
    });

    await t.test("2. authenticated POST creates a camelCase record with JSON numbers", async () => {
        const response = await request("POST", "", complete);
        assert.equal(response.status, 201);
        record = response.body;
        for (const [field, value] of Object.entries(complete)) assert.equal(record[field], value);
    });
    assert.ok(record, "Record creation must succeed before dependent checks");

    await t.test("3. ownership is assigned from the session", async () => {
        const { rows: [stored] } = await pool.query("SELECT user_id FROM rcc_records WHERE id = $1", [record.id]);
        assert.equal(stored.user_id, actors[0].id);
    });

    await t.test("4. client ownership and other protected fields are rejected for all writes", async () => {
        for (const field of ["userId", "user_id", "id", "createdAt", "updatedAt", "unexpected", "__proto__", "constructor"]) {
            for (const method of ["POST", "PATCH", "PUT"]) {
                const body = Object.fromEntries([...Object.entries(complete), [field, actors[1].id]]);
                assert.equal((await request(method, method === "POST" ? "" : `/${record.id}`, body)).status, 400);
            }
        }
    });

    await t.test("5. lists contain only owned records and order by date then descending ID", async () => {
        const other = await request("POST", "", complete, actors[1]);
        assert.equal(other.status, 201);
        const tied = await request("POST", "", complete);
        assert.equal(tied.status, 201);
        const earlier = await request("POST", "", { ...complete, recordedAt: "2025-01-01T00:00:00Z" });
        assert.equal(earlier.status, 201);
        const response = await request("GET");
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.map((row) => row.id), [tied.body.id, record.id, earlier.body.id]);
        const bList = await request("GET", "", undefined, actors[1]);
        assert.deepEqual(bList.body.map((row) => row.id), [other.body.id]);
    });

    await t.test("6. GET returns an owned record", async () => {
        const response = await request("GET", `/${record.id}`);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, record);
    });

    for (const [number, method, body] of [
        [7, "GET", undefined], [8, "PATCH", { dolor: 1 }],
        [9, "PUT", { ...complete, dolor: 5 }], [10, "DELETE", undefined]
    ]) {
        await t.test(`${number}. User B cannot ${method} User A's record`, async () => {
            const forbidden = await request(method, `/${record.id}`, body, actors[1]);
            const missing = await request(method, "/9223372036854775807", body, actors[1]);
            assert.equal(forbidden.status, 404);
            assert.deepEqual(forbidden, missing);
            assert.deepEqual((await request("GET", `/${record.id}`)).body, record);
        });
    }

    for (const [number, title, changes] of [
        [11, "gauge values below 1", ["dolor", "anergia", "fatiga", "inatencion", "estres", "somnolencia", "insomnio"].map((field) => ({ [field]: 0 }))],
        [12, "gauge values above 5", ["dolor", "anergia", "fatiga", "inatencion", "estres", "somnolencia", "insomnio"].map((field) => ({ [field]: 6 }))],
        [13, "negative cetonemia", [{ cetonemia: -0.1 }]],
        [14, "negative horasAyuno", [{ horasAyuno: -1 }]],
        [15, "nonpositive glicemia", [{ glicemia: 0 }, { glicemia: -1 }]],
        [16, "comments longer than 500 characters", [{ comentario: "x".repeat(501) }, { comentario: "😀".repeat(501) }]]
    ]) {
        await t.test(`${number}. rejects ${title}`, async () => {
            for (const change of changes) {
                for (const method of ["POST", "PATCH", "PUT"]) {
                    assert.equal((await request(method, method === "POST" ? "" : `/${record.id}`, { ...complete, ...change })).status, 400);
                }
            }
        });
    }

    await t.test("17. empty PATCH is rejected", async () => {
        assert.equal((await request("PATCH", `/${record.id}`, {})).status, 400);
    });
    await t.test("18. unknown PATCH properties are rejected", async () => {
        assert.equal((await request("PATCH", `/${record.id}`, { unknown: 1 })).status, 400);
    });
    await t.test("19. PATCH changes only specified fields and advances updatedAt", async () => {
        const response = await request("PATCH", `/${record.id}`, { dolor: 5, comentario: null });
        assert.equal(response.status, 200);
        assert.ok(Date.parse(response.body.updatedAt) > Date.parse(record.updatedAt));
        assert.deepEqual(response.body, { ...record, dolor: 5, comentario: null, updatedAt: response.body.updatedAt });
        record = response.body;
    });
    await t.test("20. PUT fully replaces every editable field, accepting nullable measurements", async () => {
        for (const field of Object.keys(complete)) {
            const incomplete = { ...complete };
            delete incomplete[field];
            assert.equal((await request("PUT", `/${record.id}`, incomplete)).status, 400);
        }
        const replacement = Object.fromEntries(Object.keys(complete).map((field) => [field, null]));
        replacement.recordedAt = "2026-01-02T03:04:05.000Z";
        const response = await request("PUT", `/${record.id}`, replacement);
        assert.equal(response.status, 200);
        for (const [field, value] of Object.entries(replacement)) assert.equal(response.body[field], value);
        assert.equal(response.body.id, record.id);
        assert.equal(response.body.createdAt, record.createdAt);
        assert.ok(Date.parse(response.body.updatedAt) > Date.parse(record.updatedAt));
    });
    await t.test("21. DELETE own record returns 204 and removes it", async () => {
        const response = await request("DELETE", `/${record.id}`);
        assert.equal(response.status, 204);
        assert.equal(response.body, null);
        assert.equal((await request("GET", `/${record.id}`)).status, 404);
        assert.equal((await pool.query("SELECT id FROM rcc_records WHERE id = $1", [record.id])).rowCount, 0);
    });
    await t.test("22. nonexistent records return 404 for every record-specific operation", async () => {
        for (const [method, body] of [["GET"], ["PATCH", { dolor: 2 }], ["PUT", complete], ["DELETE"]]) {
            assert.equal((await request(method, `/${record.id}`, body)).status, 404);
        }
    });
    await t.test("23. responses expose only the explicit safe record fields", async () => {
        // Every successful record response is checked by request(), including both lists.
        const response = await request("GET");
        assert.ok(response.body.length > 0);
        for (const row of response.body) assertSafeRecord(row);
    });

    await t.test("omitted recordedAt defaults to database time; empty POST and nullable fields work", async () => {
        const before = Date.now();
        const response = await request("POST", "", {});
        assert.equal(response.status, 201);
        assert.ok(Date.parse(response.body.recordedAt) >= before - 1000);
        assert.ok(Date.parse(response.body.recordedAt) <= Date.now() + 1000);
        for (const field of Object.keys(complete).filter((field) => field !== "recordedAt")) assert.equal(response.body[field], null);
        assert.equal((await request("PATCH", `/${response.body.id}`, { comentario: "😀".repeat(500), glicemia: 1, cetonemia: 0, horasAyuno: 0 })).status, 200);
    });

    await t.test("rejects invalid IDs, dates, value types, nonfinite numbers, and storage overflow", async () => {
        for (const id of ["0", "-1", "1.5", "abc", "1e2", "9223372036854775808", "99999999999999999999999999999999", "1%20OR%201=1"]) {
            for (const method of ["GET", "PATCH", "PUT", "DELETE"]) {
                assert.equal((await request(method, `/${id}`, method === "GET" || method === "DELETE" ? undefined : complete)).status, 400);
            }
        }
        for (const change of [
            { recordedAt: null }, { recordedAt: 123 }, { recordedAt: "today" },
            { recordedAt: "2026-02-30T10:00:00Z" }, { recordedAt: "2026-13-01T00:00:00Z" },
            { recordedAt: "2026-11-13T25:00:00Z" }, { recordedAt: "2026-11-13T10:00:00" },
            { glicemia: "97" }, { cetonemia: true }, { horasAyuno: [] },
            { dolor: 1.5 }, { anergia: "2" }, { comentario: 42 },
            { glicemia: 10000 }, { horasAyuno: 1000 }, { glicemia: 0.001 }
        ]) assert.equal((await request("POST", "", { ...complete, ...change })).status, 400);
        for (const body of [null, [], "text", 42]) assert.equal((await request("POST", "", body)).status, 400);
        assert.equal((await request("POST")).status, 400);
        for (const value of [NaN, Infinity, -Infinity]) {
            assert.ok(validateRecord({ glicemia: value }, "POST").error);
        }
        const offset = await request("POST", "", { recordedAt: "2024-02-29T10:00:00-07:00" });
        assert.equal(offset.status, 201);
        assert.equal(offset.body.recordedAt, "2024-02-29T17:00:00.000Z");
    });

    await t.test("malformed health-record JSON returns a generic response", async () => {
        const response = await fetch(`${base}/api/records`, {
            method: "POST", headers: { "Content-Type": "application/json", Cookie: actors[0].cookie },
            body: '{"comentario":"private health information",'
        });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: "Invalid request body" });
    });

    await t.test("database constraints independently reject invalid writes and accept nulls", async () => {
        for (const [column, value] of [["glicemia", 0], ["cetonemia", -1], ["horas_ayuno", -1], ["comentario", "x".repeat(501)]]) {
            await assert.rejects(pool.query(`INSERT INTO rcc_records (user_id, ${column}) VALUES ($1, $2)`, [actors[0].id, value]), { code: "23514" });
        }
        const result = await pool.query("INSERT INTO rcc_records (user_id, glicemia, cetonemia, horas_ayuno, comentario) VALUES ($1, NULL, NULL, NULL, NULL) RETURNING id", [actors[0].id]);
        assert.equal(result.rowCount, 1);
    });
});
