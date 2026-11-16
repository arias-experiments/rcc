import { api, errorMessage } from "./api.js";
import { initializeAuthPage, setBusy, showError } from "./auth.js";

const form = document.querySelector("form");
let submitting = false;
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    showError("");
    setBusy(form, true, "Iniciando sesión…");
    try {
        const request = api("/api/auth/login", {
            method: "POST",
            body: { username: form.elements.username.value.trim(), password: form.elements.password.value }
        });
        form.elements.password.value = "";
        await request;
        window.location.href = "/";
    } catch (error) {
        showError(error.status === 401 ? "Usuario o contraseña incorrectos" : errorMessage(error));
    } finally {
        form.elements.password.value = "";
        submitting = false;
        setBusy(form, false, "Iniciar sesión");
    }
});
await initializeAuthPage();
