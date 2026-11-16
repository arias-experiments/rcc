import { api, errorMessage } from "./api.js";
import { initializeAuthPage, setBusy, showError } from "./auth.js";

const form = document.querySelector("form");
let submitting = false;
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    showError("");
    if (form.elements.password.value !== form.elements.confirmPassword.value) {
        showError("Las contraseñas no coinciden.");
        form.elements.password.value = "";
        form.elements.confirmPassword.value = "";
        form.elements.password.focus();
        return;
    }
    submitting = true;
    setBusy(form, true, "Creando cuenta…");
    try {
        const request = api("/api/auth/register", {
            method: "POST",
            body: {
                displayName: form.elements.displayName.value.trim(),
                username: form.elements.username.value.trim(),
                password: form.elements.password.value
            }
        });
        form.elements.password.value = "";
        form.elements.confirmPassword.value = "";
        await request;
        window.location.href = "/";
    } catch (error) {
        showError(errorMessage(error));
    } finally {
        form.elements.password.value = "";
        form.elements.confirmPassword.value = "";
        submitting = false;
        setBusy(form, false, "Crear cuenta");
    }
});
await initializeAuthPage();
