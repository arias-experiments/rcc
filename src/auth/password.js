import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;
// A fixed hash makes unknown-user attempts perform the same expensive comparison.
export const DUMMY_PASSWORD_HASH = "$2b$12$jvdfMnF4l04zTLe7FhMnH.ptkJFS5Pqnn.S2QdIOP30SrB/WEINaK";

export function isValidPassword(password) {
    return typeof password === "string"
        && Array.from(password).length >= 10
        && Buffer.byteLength(password, "utf8") <= 72;
}

export function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}
