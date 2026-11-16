import { api, errorMessage } from "./api.js";
import { currentUser, showError } from "./auth.js";

const logout = document.querySelector("#logout");
logout.addEventListener("click", async () => {
    logout.disabled = true;
    logout.textContent = "Cerrando sesión…";
    showError("");
    try {
        await api("/api/auth/logout", { method: "POST" });
        window.location.replace("/login");
    } catch (error) {
        if (error.status === 401) {
            window.location.replace("/login");
            return;
        }
        showError(errorMessage(error));
        logout.disabled = false;
        logout.textContent = "Cerrar sesión";
    }
});

export async function initializeShell(onAuthenticated) {
    try {
        const user = await currentUser();
        if (!user) {
            window.location.replace("/login");
        } else {
            document.querySelectorAll("[data-display-name]").forEach((element) => {
                element.textContent = user.displayName;
            });
            document.querySelector("#loading").hidden = true;
            document.querySelector("#app").hidden = false;
            await onAuthenticated();
        }
    } catch (error) {
        document.querySelector("#loading").textContent = "No se pudo cargar tu sesión.";
        showError(errorMessage(error));
        document.querySelector("#retry").hidden = false;
    }
}
