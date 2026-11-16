import { api } from "./api.js";
import { initializeShell } from "./app-shell.js";
import { renderRecordForm } from "./record-form-view.js";
import { createRecordForm } from "./record-form.js";

const symptoms = {
    dolor: "Dolor", anergia: "Anergia", fatiga: "Fatiga", inatencion: "Inatención",
    estres: "Estrés", somnolencia: "Somnolencia", insomnio: "Insomnio"
};
const metrics = { glicemia: ["Glicemia", "mg/dL"], cetonemia: ["Cetonemia", "mmol/L"], horasAyuno: ["Horas de ayuno", "h"] };
const dateFormat = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const detailDateFormat = new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "medium" });
const $ = (selector) => document.querySelector(selector);
const recordDialog = $("#record-dialog");
const deleteDialog = $("#delete-dialog");
let records = [];
let selected = null;
let editor = null;
let busy = false;
let selectionVersion = 0;
let opener = null;

function show(selector, message) {
    const node = $(selector);
    node.textContent = message;
    node.hidden = !message;
}
function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function measurement(value, unit) { return value === null ? "—" : `${value} ${unit}`; }
function unauthorized(error) {
    if (error.status !== 401) return false;
    window.location.replace("/login");
    return true;
}
function renderList() {
    const entries = $("#history-entries");
    entries.replaceChildren();
    for (const record of records) {
        const button = element("button", undefined, "history-entry");
        button.type = "button";
        button.setAttribute("aria-haspopup", "dialog");
        const date = element("span", dateFormat.format(new Date(record.recordedAt)), "entry-date");
        const openHint = element("span", "Ver registro", "entry-hint");
        date.append(openHint);
        button.append(date);
        for (const [key, [label, unit]] of Object.entries(metrics)) {
            const cell = element("span", undefined, "entry-metric");
            cell.append(element("span", label, "mobile-label"), element("span", measurement(record[key], unit)));
            button.append(cell);
        }
        const summary = Object.entries(symptoms).filter(([key]) => record[key] !== null)
            .map(([key, label]) => `${label} ${record[key]}`).join(" · ");
        const symptomCell = element("span", undefined, "entry-symptoms");
        symptomCell.append(element("span", "Síntomas", "mobile-label"), element("span", summary || "—"));
        button.append(symptomCell);
        button.addEventListener("click", () => openRecord(record, button));
        entries.append(button);
    }
    $("#history-list").hidden = records.length === 0;
    $("#history-empty").hidden = records.length !== 0;
}
async function loadRecords() {
    $("#history-loading").hidden = false;
    $("#history-list").hidden = true;
    $("#history-empty").hidden = true;
    $("#history-error").hidden = true;
    $("#history-retry").disabled = true;
    try {
        const result = await api("/api/records");
        if (!Array.isArray(result)) throw new Error("Unexpected response");
        records = result;
        renderList();
    } catch (error) {
        if (!unauthorized(error)) $("#history-error").hidden = false;
    } finally {
        $("#history-loading").hidden = true;
        $("#history-retry").disabled = false;
    }
}
function renderDetail() {
    const container = $("#record-detail");
    container.replaceChildren();
    const list = element("dl", undefined, "detail-values");
    const add = (label, value) => {
        const pair = element("div");
        pair.append(element("dt", label), element("dd", value));
        list.append(pair);
    };
    add("Fecha y hora", detailDateFormat.format(new Date(selected.recordedAt)));
    for (const [key, [label, unit]] of Object.entries(metrics)) add(label, measurement(selected[key], unit));
    for (const [key, label] of Object.entries(symptoms)) add(label, selected[key] === null ? "Sin seleccionar" : `${selected[key]} / 5`);
    const comment = element("div", undefined, "detail-comment");
    comment.append(element("h3", "Comentario"), element("p", selected.comentario ?? "Sin comentario"));
    container.append(list, comment);
    container.hidden = false;
    $("#detail-actions").hidden = false;
    $("#edit-container").hidden = true;
    $("#detail-title").textContent = "Detalle del registro";
}
async function openRecord(record, button) {
    opener = button;
    const version = ++selectionVersion;
    selected = null;
    show("#detail-error", "");
    show("#detail-feedback", "");
    $("#record-detail").replaceChildren(element("p", "Cargando registro…", "status"));
    $("#record-detail").hidden = false;
    $("#detail-actions").hidden = true;
    $("#edit-container").hidden = true;
    recordDialog.showModal();
    $("#detail-title").focus();
    try {
        const result = await api(`/api/records/${encodeURIComponent(record.id)}`);
        if (version !== selectionVersion || !recordDialog.open) return;
        selected = result;
        renderDetail();
    } catch (error) {
        if (version !== selectionVersion || !recordDialog.open) return;
        if (unauthorized(error)) return;
        if (error.status === 404) await unavailable();
        else {
            $("#record-detail").replaceChildren();
            show("#detail-error", "No se pudo cargar el registro. Cierra esta ventana e inténtalo nuevamente.");
        }
    }
}
function setBusy(value) {
    busy = value;
    for (const selector of ["#detail-close", "#edit-record", "#delete-record", "#cancel-delete", "#confirm-delete"]) $(selector).disabled = value;
    $("#confirm-delete").textContent = value ? "Eliminando…" : "Eliminar";
    recordDialog.setAttribute("aria-busy", String(value));
    deleteDialog.setAttribute("aria-busy", String(value));
}
async function unavailable() {
    if (deleteDialog.open) deleteDialog.close();
    if (recordDialog.open) recordDialog.close();
    show("#history-notice", "El registro ya no está disponible. Se ha actualizado el historial.");
    await loadRecords();
    $("#history-title").focus();
}
function enterEdit() {
    if (!selected || busy) return;
    show("#detail-error", "");
    show("#detail-feedback", "");
    $("#record-detail").hidden = true;
    $("#detail-actions").hidden = true;
    $("#detail-title").textContent = "Editar registro";
    const form = renderRecordForm($("#edit-container"), { editing: true });
    editor = createRecordForm(form);
    editor.load(selected);
    $("#edit-container").hidden = false;
    $("#recordedAt").focus();
    $("#clear-record").addEventListener("click", () => {
        if (busy) return;
        renderDetail();
        $("#edit-record").focus();
    });
    form.addEventListener("submit", saveChanges);
}
async function saveChanges(event) {
    event.preventDefault();
    if (busy || !selected) return;
    editor.clearFeedback();
    const values = editor.read();
    if (!values) return;
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => {
        if (key === "recordedAt") return Date.parse(value) !== Date.parse(selected[key]);
        if (key === "comentario" && value === null && selected[key] === "") return false;
        return value !== selected[key];
    }));
    if (!Object.keys(changes).length) {
        renderDetail();
        show("#detail-feedback", "No hay cambios que guardar.");
        $("#edit-record").focus();
        return;
    }
    setBusy(true);
    editor.setBusy(true, "Guardando…");
    try {
        const updated = await api(`/api/records/${encodeURIComponent(selected.id)}`, { method: "PATCH", body: changes, expectedStatus: 200 });
        records = records.map((record) => record.id === updated.id ? updated : record);
        if (Object.hasOwn(changes, "recordedAt")) {
            // Keep the backend's ordering after the edited date moves a row.
            records.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)
                || (BigInt(a.id) === BigInt(b.id) ? 0 : BigInt(a.id) > BigInt(b.id) ? -1 : 1));
        }
        selected = updated;
        renderList();
        renderDetail();
        show("#detail-feedback", "Registro actualizado correctamente");
        $("#detail-title").focus();
    } catch (error) {
        if (unauthorized(error)) return;
        if (error.status === 404) await unavailable();
        else editor.showError(error.status === 400 ? editor.validationError(error.message)
            : "No se pudo actualizar el registro. Inténtalo nuevamente.");
    } finally {
        setBusy(false);
        // Closing a missing record releases its editor.
        if (editor) {
            editor.setBusy(false, "Guardar cambios");
            editor.focusInvalid();
        }
    }
}
async function deleteRecord() {
    if (busy || !selected) return;
    const id = selected.id;
    setBusy(true);
    show("#delete-error", "");
    try {
        await api(`/api/records/${encodeURIComponent(id)}`, { method: "DELETE", expectedStatus: 204 });
        records = records.filter((record) => record.id !== id);
        deleteDialog.close();
        recordDialog.close();
        renderList();
        show("#history-feedback", "Registro eliminado");
        $("#history-title").focus();
    } catch (error) {
        if (unauthorized(error)) return;
        if (error.status === 404) await unavailable();
        else show("#delete-error", "No se pudo eliminar el registro. Inténtalo nuevamente.");
    } finally { setBusy(false); }
}
$("#history-retry").addEventListener("click", loadRecords);
$("#detail-close").addEventListener("click", () => { if (!busy) recordDialog.close(); });
$("#edit-record").addEventListener("click", enterEdit);
$("#delete-record").addEventListener("click", () => {
    if (busy || !selected) return;
    show("#delete-error", "");
    deleteDialog.showModal();
    $("#cancel-delete").focus();
});
$("#cancel-delete").addEventListener("click", () => { if (!busy) deleteDialog.close(); });
$("#confirm-delete").addEventListener("click", deleteRecord);
for (const dialog of [recordDialog, deleteDialog]) dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
});
deleteDialog.addEventListener("close", () => {
    if (recordDialog.open && !busy) $("#delete-record").focus();
});
recordDialog.addEventListener("close", () => {
    selectionVersion++;
    selected = null;
    editor = null;
    $("#edit-container").replaceChildren();
    $("#record-detail").replaceChildren();
    // A list refresh may have replaced the button that opened this dialog.
    if (opener?.isConnected) opener.focus();
    else $("#history-title").focus();
});
await initializeShell(loadRecords);
