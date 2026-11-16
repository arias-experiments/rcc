import { api } from "./api.js";
import { initializeShell } from "./app-shell.js";
import { loadChartLibrary } from "./chart-library.js";
import { measurements, symptoms, comparisons, localDateKey, filterRecords, average, chronological, linePoints, scatterPoints } from "./charts-data.js";

const $ = (selector) => document.querySelector(selector);
const localDateTime = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const axisDate = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const instances = new Map();
let records = null;
let selectedRecords = [];
let ChartClass;
let loading = false;

function format(value, decimals = 1) {
    return value === null ? "—" : new Intl.NumberFormat("es", { maximumFractionDigits: decimals }).format(value);
}
function destroy(key) {
    instances.get(key)?.destroy();
    instances.delete(key);
}
function destroyAll() { for (const key of [...instances.keys()]) destroy(key); }
function chartState(key, count, message, label) {
    destroy(key);
    $(`#${key}-description`).textContent = `${count} ${count === 1 ? "punto disponible" : "puntos disponibles"} · ${label}`;
    $(`#${key}-plot`).hidden = count === 0;
    $(`#${key}-empty`).textContent = message;
    $(`#${key}-empty`).hidden = count !== 0;
    return count > 0;
}
function baseOptions() {
    return {
        responsive: true, maintainAspectRatio: false, animation: false,
        locale: "es", interaction: { mode: "nearest", intersect: false },
        plugins: { legend: { display: false } },
        scales: {
            x: { type: "linear", title: { display: true, text: "Fecha y hora local" }, grid: { display: false },
                ticks: { maxTicksLimit: 6, maxRotation: 0, callback: (value) => axisDate.format(new Date(value)) } },
            y: { grid: { color: "#eee8f6" } }
        }
    };
}
function renderLine(key, field, label, unit, isSymptom = false) {
    const data = linePoints(selectedRecords, field);
    const count = data.filter((point) => point.y !== null).length;
    $(`#${key}-chart`).setAttribute("aria-label", `${label} en el tiempo, ${isSymptom ? "escala de 1 a 5" : unit}`);
    if (!chartState(key, count, `No hay datos de ${label.toLocaleLowerCase("es")} en este período.`, `${label} (${unit})`)) return;
    const options = baseOptions();
    options.parsing = false;
    options.scales.y.title = { display: true, text: `${label} (${unit})` };
    if (isSymptom) {
        options.scales.y.min = 1;
        options.scales.y.max = 5;
        options.scales.y.ticks = { stepSize: 1, precision: 0 };
    }
    options.plugins.tooltip = { callbacks: {
        title: (items) => items.length ? localDateTime.format(new Date(items[0].raw.x)) : "",
        label: (context) => `${label}: ${format(context.raw.y, measurements[field]?.decimals ?? 0)} ${unit}`
    } };
    instances.set(key, new ChartClass($(`#${key}-chart`), {
        type: "line", data: { datasets: [{ label, data, spanGaps: false, tension: 0, fill: false,
            borderColor: "#6543ad", backgroundColor: "#6543ad", borderWidth: 2,
            pointRadius: 3, pointHoverRadius: 6, pointHitRadius: 12 }] }, options
    }));
}
function renderSymptom() {
    const field = $("#symptom-select").value;
    renderLine("symptom", field, symptoms[field], "1–5", true);
}
function renderComparison() {
    const [xField, yField] = comparisons[$("#comparison-select").value];
    const x = measurements[xField], y = measurements[yField];
    const data = scatterPoints(selectedRecords, xField, yField);
    const label = `${x.label} (${x.unit}) frente a ${y.label} (${y.unit})`;
    $("#comparison-chart").setAttribute("aria-label", label);
    if (!chartState("comparison", data.length, "No hay pares de mediciones completos para esta comparación en este período.", label)) return;
    const options = baseOptions();
    options.scales.x = { type: "linear", title: { display: true, text: `${x.label} (${x.unit})` }, grid: { color: "#eee8f6" } };
    options.scales.y.title = { display: true, text: `${y.label} (${y.unit})` };
    options.plugins.tooltip = { callbacks: {
        title: (items) => items.length ? localDateTime.format(new Date(items[0].raw.recordedAt)) : "",
        label: (context) => [ `${x.label}: ${format(context.raw.x, x.decimals)} ${x.unit}`, `${y.label}: ${format(context.raw.y, y.decimals)} ${y.unit}` ]
    } };
    instances.set("comparison", new ChartClass($("#comparison-chart"), {
        type: "scatter", data: { datasets: [{ label, data, showLine: false, backgroundColor: "#6543ad", pointRadius: 5, pointHoverRadius: 7, pointHitRadius: 12 }] }, options
    }));
}
function render() {
    if (records === null || !ChartClass) return;
    const period = $('input[name="period"]:checked').value;
    $("#custom-dates").hidden = period !== "custom";
    try {
        selectedRecords = chronological(filterRecords(records, { period, from: $("#date-from").value, to: $("#date-to").value }));
    } catch (error) {
        $("#period-error").textContent = error.message;
        $("#period-error").hidden = false;
        $("#charts-content").hidden = true;
        destroyAll();
        return;
    }
    $("#period-error").hidden = true;
    $("#charts-content").hidden = false;
    $("#summary-count").textContent = String(selectedRecords.length);
    for (const [field, metric] of Object.entries(measurements)) $("#summary-" + field).textContent = format(average(selectedRecords, field), metric.decimals);
    $("#charts-empty").hidden = selectedRecords.length !== 0;
    $("#chart-panels").hidden = selectedRecords.length === 0;
    if (!selectedRecords.length) { destroyAll(); return; }
    for (const [field, metric] of Object.entries(measurements)) renderLine(field, field, field === "horasAyuno" ? "Horas de ayuno" : metric.label, metric.unit);
    renderSymptom();
    renderComparison();
}
async function load() {
    if (loading) return;
    loading = true;
    $("#charts-loading").hidden = false;
    $("#charts-error").hidden = true;
    $("#charts-retry").disabled = true;
    try {
        if (records === null) {
            const result = await api("/api/records");
            if (!Array.isArray(result)) throw new Error("Unexpected response");
            records = result;
        }
        ChartClass = await loadChartLibrary();
        render();
    } catch (error) {
        if (error.status === 401) { window.location.replace("/login"); return; }
        destroyAll();
        $("#charts-content").hidden = true;
        $("#charts-error-message").textContent = records === null
            ? "No se pudieron cargar los registros. Inténtalo nuevamente."
            : "No se pudieron cargar las gráficas. Comprueba tu conexión e inténtalo nuevamente.";
        $("#charts-error").hidden = false;
    } finally {
        loading = false;
        $("#charts-loading").hidden = true;
        $("#charts-retry").disabled = false;
    }
}
const today = new Date();
const initialStart = new Date(today);
initialStart.setDate(initialStart.getDate() - 29);
$("#date-from").value = localDateKey(initialStart);
$("#date-to").value = localDateKey(today);
$("#period-controls").addEventListener("change", () => {
    $("#custom-dates").hidden = $('input[name="period"]:checked').value !== "custom";
    render();
});
for (const id of ["#date-from", "#date-to"]) $(id).addEventListener("change", render);
$("#symptom-select").addEventListener("change", () => { if (ChartClass && selectedRecords.length) renderSymptom(); });
$("#comparison-select").addEventListener("change", () => { if (ChartClass && selectedRecords.length) renderComparison(); });
$("#charts-retry").addEventListener("click", load);
window.addEventListener("pagehide", destroyAll);
await initializeShell(load);
