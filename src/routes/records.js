import express from "express";
import { pool } from "../db/pool.js";
import requireAuth from "../middleware/requireAuth.js";
import { RECORD_FIELDS, validateRecord, validRecordId } from "../validation/record.js";

const router = express.Router();
const columns = ["id", ...Object.values(RECORD_FIELDS), "created_at", "updated_at"].join(", ");
const numericFields = new Set(["glicemia", "cetonemia", "horasAyuno"]);

function recordJson(row) {
    const record = { id: row.id };
    for (const [field, column] of Object.entries(RECORD_FIELDS)) {
        record[field] = numericFields.has(field) && row[column] !== null ? Number(row[column]) : row[column];
    }
    return { ...record, createdAt: row.created_at, updatedAt: row.updated_at };
}

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
router.use(requireAuth);
router.param("id", (req, res, next, id) => {
    if (!validRecordId(id)) return res.status(400).json({ error: "Record ID must be a positive BIGINT integer" });
    next();
});

router.get("/", async (req, res) => {
    const result = await pool.query(
        `SELECT ${columns} FROM rcc_records WHERE user_id = $1 ORDER BY recorded_at DESC, id DESC`,
        [req.user.id]
    );
    res.json(result.rows.map(recordJson));
});

router.get("/:id", async (req, res) => {
    const result = await pool.query(
        `SELECT ${columns} FROM rcc_records WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Record not found" });
    res.json(recordJson(result.rows[0]));
});

router.post("/", async (req, res) => {
    const { values, error } = validateRecord(req.body, "POST");
    if (error) return res.status(400).json({ error });
    const fields = Object.keys(values);
    const insertColumns = ["user_id", ...fields.map((field) => RECORD_FIELDS[field])];
    const parameters = [req.user.id, ...fields.map((field) => values[field])];
    const placeholders = parameters.map((_, index) => `$${index + 1}`);
    const result = await pool.query(
        `INSERT INTO rcc_records (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${columns}`,
        parameters
    );
    res.status(201).json(recordJson(result.rows[0]));
});

async function updateRecord(req, res) {
    const { values, error } = validateRecord(req.body, req.method);
    if (error) return res.status(400).json({ error });
    const fields = Object.keys(values);
    // Only fixed whitelist column names enter SQL; all request values are parameters.
    const assignments = fields.map((field, index) => `${RECORD_FIELDS[field]} = $${index + 1}`);
    const parameters = fields.map((field) => values[field]);
    parameters.push(req.params.id, req.user.id);
    const result = await pool.query(
        `UPDATE rcc_records SET ${assignments.join(", ")}, updated_at = NOW()
         WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2} RETURNING ${columns}`,
        parameters
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Record not found" });
    res.json(recordJson(result.rows[0]));
}
router.patch("/:id", updateRecord);
router.put("/:id", updateRecord);

router.delete("/:id", async (req, res) => {
    const result = await pool.query(
        "DELETE FROM rcc_records WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Record not found" });
    res.status(204).end();
});

// Express 5 forwards rejected route promises here. Never log records or SQL errors.
router.use((error, req, res, next) => {
    if (["23514", "22003", "22007", "22008"].includes(error.code)) {
        return res.status(400).json({ error: "Record values exceed database constraints or supported storage precision" });
    }
    return res.status(500).json({ error: "Unable to process records request" });
});

export default router;
