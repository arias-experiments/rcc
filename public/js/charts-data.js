export const measurements = {
    glicemia: { label: "Glicemia", unit: "mg/dL", decimals: 1 },
    cetonemia: { label: "Cetonemia", unit: "mmol/L", decimals: 2 },
    horasAyuno: { label: "Ayuno", unit: "h", decimals: 1 }
};
export const symptoms = {
    dolor: "Dolor", anergia: "Anergia", fatiga: "Fatiga", inatencion: "Inatención",
    estres: "Estrés", somnolencia: "Somnolencia", insomnio: "Insomnio"
};
export const comparisons = {
    "fasting-glucose": ["horasAyuno", "glicemia"],
    "fasting-ketones": ["horasAyuno", "cetonemia"],
    "glucose-ketones": ["glicemia", "cetonemia"]
};
export function localDateKey(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function calendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Selecciona una fecha válida en Desde y Hasta.");
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(date.getTime()) || localDateKey(date) !== value) throw new RangeError("Selecciona una fecha válida en Desde y Hasta.");
    return date;
}
export function filterRecords(records, { period, from, to, now = new Date() }) {
    if (period === "all") return [...records];
    let start, end;
    if (period === "custom") {
        start = calendarDate(from);
        end = calendarDate(to);
        if (start > end) throw new RangeError("La fecha Desde debe ser anterior o igual a Hasta.");
    } else {
        const days = Number(period);
        if (![7, 30, 90].includes(days)) throw new RangeError("Selecciona un período válido.");
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start = new Date(end);
        start.setDate(start.getDate() - days + 1);
    }
    // Calendar operations include the entire end day across daylight-saving changes.
    end.setDate(end.getDate() + 1);
    return records.filter((record) => {
        const time = new Date(record.recordedAt);
        return time >= start && time < end;
    });
}
export function numericValue(record, field) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (Object.hasOwn(symptoms, field)) return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
    return (field === "glicemia" ? value > 0 : value >= 0) ? value : null;
}
export function average(records, field) {
    const values = records.map((record) => numericValue(record, field)).filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
export function chronological(records) {
    return [...records].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
}
export function linePoints(records, field) {
    return records.map((record) => ({ x: Date.parse(record.recordedAt), y: numericValue(record, field) }));
}
export function scatterPoints(records, xField, yField) {
    return records.flatMap((record) => {
        const x = numericValue(record, xField), y = numericValue(record, yField);
        return x === null || y === null ? [] : [{ x, y, recordedAt: record.recordedAt }];
    });
}
