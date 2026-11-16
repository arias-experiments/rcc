import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS database_time");

        res.status(200).json({
            status: "ok",
            database: "connected",
            databaseTime: result.rows[0].database_time
        });
    }
    catch (error) {
        console.error("Database health check failed:", error.message);

        res.status(500).json({
            status: "error",
            database: "disconnected"
        });
    }
});

export default router;