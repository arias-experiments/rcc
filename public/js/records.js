import { api } from "./api.js";
import { renderRecordForm } from "./record-form-view.js";
import { createRecordForm } from "./record-form.js";

export function initializeRecords() {
    const form = renderRecordForm(document.querySelector("#record-editor"));
    const editor = createRecordForm(form);
    let saving = false;
    document.querySelector("#clear-record").addEventListener("click", () => {
        if (!saving) editor.reset();
    });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (saving) return;
        editor.clearFeedback();
        const body = editor.read();
        if (!body) return;
        saving = true;
        editor.setBusy(true, "Guardando…");
        try {
            await api("/api/records", { method: "POST", body, expectedStatus: 201 });
            editor.reset();
            editor.showSuccess("Registro guardado correctamente");
        } catch (error) {
            if (error.status === 401) {
                window.location.replace("/login");
                return;
            }
            editor.showError(error.status === 400 ? editor.validationError(error.message)
                : "No se pudo guardar el registro. Inténtalo nuevamente.");
        } finally {
            saving = false;
            editor.setBusy(false, "Guardar registro");
            editor.focusInvalid();
        }
    });
}
