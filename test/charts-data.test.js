import assert from "node:assert/strict";
import test from "node:test";
import { filterRecords, average, chronological, linePoints, scatterPoints } from "../public/js/charts-data.js";

process.env.TZ = "America/Los_Angeles";
const record = (recordedAt, values = {}) => ({ recordedAt, ...values });
const now = new Date("2026-11-16T12:00:00-08:00");

test("presets include whole local calendar days across daylight-saving changes", () => {
    for (const [period, start] of [["7", "2026-11-10T00:00:00-08:00"], ["30", "2026-10-18T00:00:00-07:00"], ["90", "2026-08-19T00:00:00-07:00"]]) {
        const startTime = Date.parse(start);
        const rows = [record(new Date(startTime - 1).toISOString()), record(start), record("2026-11-16T23:59:59.999-08:00"), record("2026-11-17T00:00:00-08:00")];
        assert.deepEqual(filterRecords(rows, { period, now }), [rows[1], rows[2]]);
    }
});

test("custom dates include both occurrences of a repeated hour and the entire end day", () => {
    const rows = [
        record("2026-11-01T06:59:59.999Z"), // Previous local day.
        record("2026-11-01T07:00:00Z"),
        record("2026-11-01T08:30:00Z"),
        record("2026-11-01T09:30:00Z"),
        record("2026-11-02T07:59:59.999Z"),
        record("2026-11-02T08:00:00Z")
    ];
    assert.deepEqual(filterRecords(rows, { period: "custom", from: "2026-11-01", to: "2026-11-01" }), rows.slice(1, 5));
});

test("invalid or reversed custom ranges are rejected", () => {
    for (const [from, to] of [["", "2026-11-16"], ["2026-02-30", "2026-03-01"], ["2026-11-17", "2026-11-16"]]) {
        assert.throws(() => filterRecords([], { period: "custom", from, to }), RangeError);
    }
});

test("all-time and chronological views do not reorder the source array", () => {
    const rows = [record("2026-11-16T10:00:00Z"), record("2026-01-01T10:00:00Z")];
    const original = structuredClone(rows);
    assert.deepEqual(filterRecords(rows, { period: "all" }), original);
    assert.deepEqual(chronological(rows), [rows[1], rows[0]]);
    assert.deepEqual(rows, original);
});

test("averages ignore null and invalid values while preserving real zeros", () => {
    const rows = [{ glicemia: 90, cetonemia: 0 }, { glicemia: null, cetonemia: null }, { glicemia: 100, cetonemia: 1 }, { glicemia: "120", cetonemia: Infinity }];
    assert.equal(average(rows, "glicemia"), 95);
    assert.equal(average(rows, "cetonemia"), 0.5);
    assert.equal(average(rows, "horasAyuno"), null);
});

test("line data retains null gaps and symptom values stay in the 1–5 integer scale", () => {
    const rows = [record("2026-11-01T12:00:00Z", { fatiga: 1 }), record("2026-11-02T12:00:00Z", { fatiga: null }), record("2026-11-03T12:00:00Z", { fatiga: 5 }), record("2026-11-04T12:00:00Z", { fatiga: 0 })];
    assert.deepEqual(linePoints(rows, "fatiga").map((point) => point.y), [1, null, 5, null]);
});

test("scatter includes only complete valid pairs and retains dates without user metadata", () => {
    const rows = [record("2026-11-01T12:00:00Z", { horasAyuno: 0, glicemia: 95, userId: "private" }), record("2026-11-02T12:00:00Z", { horasAyuno: 12, glicemia: null }), record("2026-11-03T12:00:00Z", { horasAyuno: null, glicemia: 100 })];
    assert.deepEqual(scatterPoints(rows, "horasAyuno", "glicemia"), [{ x: 0, y: 95, recordedAt: rows[0].recordedAt }]);
});
