const measurements = {
    glicemia: "La glicemia debe ser un número mayor que 0.",
    cetonemia: "La cetonemia debe ser un número mayor o igual que 0.",
    horasAyuno: "Las horas de ayuno deben ser un número mayor o igual que 0."
};
const gauges = ["dolor", "anergia", "fatiga", "inatencion", "estres", "somnolencia", "insomnio"];
const dateError = "Introduce una fecha y hora local válidas.";
const commentError = "El comentario no puede superar los 500 caracteres.";

export function createRecordForm(form) {
    const fields = document.querySelector("#record-fields");
    const save = document.querySelector("#save-record");
    const success = document.querySelector("#record-success");
    const errorNotice = document.querySelector("#record-error");
    const comment = form.elements.comentario;
    const date = form.elements.recordedAt;
    let originalDate = null;
    let initialDateValue = null;

    function localNow() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    function updateCount() {
        // Match the API's Unicode code-point limit, including pasted emoji.
        const characters = Array.from(comment.value);
        if (characters.length > 500) comment.value = characters.slice(0, 500).join("");
        document.querySelector("#comment-count").textContent = `${Math.min(characters.length, 500)} / 500`;
    }

    function fieldError(name, message) {
        const notice = document.getElementById(`${name}-error`);
        notice.textContent = message;
        notice.hidden = !message;
        form.querySelectorAll(`[name="${name}"]`).forEach((input) => {
            if (message) input.setAttribute("aria-invalid", "true");
            else input.removeAttribute("aria-invalid");
        });
    }

    function clearFeedback() {
        errorNotice.hidden = true;
        errorNotice.textContent = "";
        success.hidden = true;
        success.textContent = "";
        for (const name of ["recordedAt", ...Object.keys(measurements), ...gauges, "comentario"]) fieldError(name, "");
    }

    function resetValues() {
        originalDate = null;
        initialDateValue = null;
        form.reset();
        date.value = localNow();
        updateCount();
        clearFeedback();
    }

    function focusInvalid() {
        form.querySelector('[aria-invalid="true"]')?.focus();
    }

    function payload() {
        const result = {};
        let valid = true;
        const localDate = date.value;
        const parsed = new Date(localDate);
        const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDate);
        // Reject normalized invalid dates and nonexistent local times at DST changes.
        if (!parts || Number(parts[1]) < 1 || !Number.isFinite(parsed.getTime())
            || [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate(), parsed.getHours(), parsed.getMinutes()]
                .some((value, index) => value !== Number(parts[index + 1]))) {
            fieldError("recordedAt", dateError);
            valid = false;
        } else result.recordedAt = originalDate && localDate === initialDateValue
            ? originalDate : parsed.toISOString();

        for (const [name, message] of Object.entries(measurements)) {
            const input = form.elements[name];
            const value = input.value === "" ? null : input.valueAsNumber;
            if (input.validity.badInput || (value !== null && (!Number.isFinite(value) || (name === "glicemia" ? value <= 0 : value < 0)))) {
                fieldError(name, message);
                valid = false;
            }
            result[name] = value;
        }
        for (const name of gauges) {
            const raw = form.elements[name].value;
            const value = raw === "" ? null : Number(raw);
            if (value !== null && (!Number.isInteger(value) || value < 1 || value > 5)) {
                fieldError(name, "Selecciona un valor entero del 1 al 5 o deja el indicador sin seleccionar.");
                valid = false;
            }
            result[name] = value;
        }
        if (Array.from(comment.value).length > 500) {
            fieldError("comentario", commentError);
            valid = false;
        }
        result.comentario = comment.value === "" ? null : comment.value;
        if (!valid) { focusInvalid(); return null; }
        return result;
    }

    function validationError(message) {
        const expected = {
            "recordedAt must be a valid ISO-8601 date/time with a timezone": ["recordedAt", dateError],
            "comentario must be a string of at most 500 characters or null": ["comentario", commentError]
        };
        for (const [name, text] of Object.entries(measurements)) {
            expected[`${name} must be a finite ${name === "glicemia" ? "positive" : "nonnegative"} number or null`] = [name, text];
        }
        for (const name of gauges) {
            expected[`${name} must be an integer from 1 to 5 or null`] = [name, "Selecciona un valor entero del 1 al 5 o deja el indicador sin seleccionar."];
        }
        if (Object.hasOwn(expected, message)) {
            fieldError(...expected[message]);
            return "Revisa el campo indicado antes de guardar.";
        }
        if (message === "Record values exceed database constraints or supported storage precision") {
            return "Revisa las mediciones: alguno de los valores supera la capacidad de almacenamiento o su precisión admitida.";
        }
        return "Revisa la fecha, las mediciones y los indicadores antes de guardar.";
    }

    comment.addEventListener("input", updateCount);
    form.addEventListener("input", (event) => {
        if (event.target.name) fieldError(event.target.name, "");
        success.hidden = true;
    });
    function load(record) {
        resetValues();
        const parsed = new Date(record.recordedAt);
        const pad = (value) => String(value).padStart(2, "0");
        date.value = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
        originalDate = record.recordedAt;
        initialDateValue = date.value;
        for (const name of Object.keys(measurements)) form.elements[name].value = record[name] ?? "";
        for (const name of gauges) form.elements[name].value = record[name] === null ? "" : String(record[name]);
        comment.value = record.comentario ?? "";
        updateCount();
    }
    function setBusy(busy, label) {
        fields.disabled = busy;
        form.setAttribute("aria-busy", String(busy));
        save.textContent = label;
    }
    function showError(message) {
        errorNotice.textContent = message;
        errorNotice.hidden = !message;
    }
    function showSuccess(message) {
        success.textContent = message;
        success.hidden = !message;
    }
    resetValues();
    fields.disabled = false;
    return { read: payload, load, reset: resetValues, clearFeedback, validationError,
        setBusy, showError, showSuccess, focusInvalid };
}
