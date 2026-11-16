export const RECORD_FIELDS = Object.freeze({
    recordedAt: "recorded_at",
    glicemia: "glicemia",
    cetonemia: "cetonemia",
    horasAyuno: "horas_ayuno",
    dolor: "dolor",
    anergia: "anergia",
    fatiga: "fatiga",
    inatencion: "inatencion",
    estres: "estres",
    somnolencia: "somnolencia",
    insomnio: "insomnio",
    comentario: "comentario"
});

const gauges = new Set(["dolor", "anergia", "fatiga", "inatencion", "estres", "somnolencia", "insomnio"]);

function validRecordedAt(value) {
    if (typeof value !== "string") return false;
    // Require a calendar date and time with an explicit timezone, avoiding host-local time.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return false;
    const [, year, month, day, hour, minute, second = "0", zone] = match;
    const y = Number(year);
    const m = Number(month);
    const days = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (y < 1 || m < 1 || m > 12 || Number(day) < 1 || Number(day) > days[m - 1]
        || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
    if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return false;
    return Number.isFinite(Date.parse(value));
}

export function validRecordId(id) {
    return typeof id === "string" && /^[1-9]\d{0,18}$/.test(id)
        && BigInt(id) <= 9223372036854775807n;
}

export function validateRecord(body, method) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Request body must be a JSON object" };
    }
    const keys = Object.keys(body);
    if (keys.some((key) => !Object.hasOwn(RECORD_FIELDS, key))) {
        return { error: "Unknown or protected record property" };
    }
    if (method === "PATCH" && keys.length === 0) {
        return { error: "PATCH requires at least one editable property" };
    }
    if (method === "PUT" && Object.keys(RECORD_FIELDS).some((key) => !Object.hasOwn(body, key))) {
        return { error: "PUT requires all editable record properties" };
    }
    const values = {};
    for (const key of keys) {
        const value = body[key];
        if (key === "recordedAt") {
            if (!validRecordedAt(value)) return { error: "recordedAt must be a valid ISO-8601 date/time with a timezone" };
            values[key] = new Date(value);
            continue;
        }
        if (value === null) {
            values[key] = null;
            continue;
        }
        if (key === "comentario") {
            if (typeof value !== "string" || Array.from(value).length > 500) {
                return { error: "comentario must be a string of at most 500 characters or null" };
            }
        } else if (gauges.has(key)) {
            if (!Number.isInteger(value) || value < 1 || value > 5) {
                return { error: `${key} must be an integer from 1 to 5 or null` };
            }
        } else if (typeof value !== "number" || !Number.isFinite(value)
            || (key === "glicemia" ? value <= 0 : value < 0)) {
            return { error: `${key} must be a finite ${key === "glicemia" ? "positive" : "nonnegative"} number or null` };
        }
        values[key] = value;
    }
    return { values };
}
