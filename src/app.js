import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import healthRouter from "./routes/health.js";
import recordsRouter from "./routes/records.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({
        name: "RCC API",
        status: "running"
    });
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/records", recordsRouter);

// Parser errors occur before the router; keep health-record payloads out of logs.
app.use("/api/records", (error, req, res, next) => {
    if (error.status >= 400 && error.status < 500) {
        return res.status(400).json({ error: "Invalid request body" });
    }
    return res.status(500).json({ error: "Unable to process records request" });
});

// Handle parser failures here too, so malformed auth bodies cannot reach Express's
// default error logger or expose request contents and stack traces.
app.use("/api/auth", (error, req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({ error: "Request body too large" });
    }
    if (error.status === 400) {
        return res.status(400).json({ error: "Invalid request body" });
    }
    return res.status(500).json({ error: "Unable to process authentication request" });
});

export default app;
