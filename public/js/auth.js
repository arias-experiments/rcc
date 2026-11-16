import { api, errorMessage } from "./api.js";

export async function currentUser() {
    try {
        return await api("/api/auth/me");
    } catch (error) {
        if (error.status === 401) return null;
        throw error;
    }
}

export function showError(message) {
    const notice = document.querySelector("#error");
    notice.textContent = message;
    notice.hidden = !message;
}

export function setBusy(form, busy, label) {
    form.querySelector("fieldset").disabled = busy;
    form.setAttribute("aria-busy", String(busy));
    form.querySelector('[type="submit"]').textContent = label;
}

export async function initializeAuthPage() {
    try {
        if (await currentUser()) {
            window.location.replace("/");
            return false;
        }
        document.querySelector("fieldset").disabled = false;
        document.querySelector("#session-status").textContent = "";
        return true;
    } catch (error) {
        showError(errorMessage(error));
        document.querySelector("#session-status").textContent = "No se pudo comprobar la sesión.";
        document.querySelector("#retry").hidden = false;
        return false;
    }
}

document.querySelector("#retry")?.addEventListener("click", () => window.location.reload());
// Recheck the session when a page is restored with the browser's back button.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
});
