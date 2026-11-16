import { pool } from "../db/pool.js";
import { hashSessionToken, safeUser, SESSION_COOKIE_NAME } from "../auth/session.js";

export default async function requireAuth(req, res, next) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== "string" || !token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.display_name
             FROM user_sessions AS s
             JOIN users AS u ON u.id = s.user_id
             WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
            [hashSessionToken(token)]
        );

        if (!result.rows[0]) {
            return res.status(401).json({ error: "Authentication required" });
        }

        req.user = safeUser(result.rows[0]);
        return next();
    } catch {
        return res.status(500).json({ error: "Unable to authenticate request" });
    }
}
