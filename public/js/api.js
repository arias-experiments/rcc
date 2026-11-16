export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// The browser manages the HttpOnly session cookie. Never persist credentials.
export async function api(path, { method = "GET", body, expectedStatus } = {}) {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
        throw new ApiError(0, "Solicitud no válida.");
    }
    let response;
    try {
        response = await fetch(url, {
            method,
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                ...(body === undefined ? {} : { "Content-Type": "application/json" })
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(15000)
        });
    } catch {
        throw new ApiError(0, "No pudimos conectar con RCC. Comprueba tu conexión e inténtalo de nuevo.");
    }
    let data = null;
    try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text);
    } catch {
        throw new ApiError(response.status, "No pudimos procesar la respuesta. Inténtalo de nuevo.");
    }
    if (!response.ok) {
        throw new ApiError(response.status, typeof data?.error === "string" ? data.error : "Solicitud fallida.");
    }
    if (expectedStatus !== undefined && response.status !== expectedStatus) {
        throw new ApiError(response.status, "Respuesta inesperada del servidor.");
    }
    return data;
}

const validationMessages = {
    "Username already exists": "Este usuario ya existe. Elige otro nombre de usuario.",
    "Username must contain 3 to 50 letters, numbers, dots, underscores, or hyphens":
        "El usuario debe tener entre 3 y 50 letras, números, puntos, guiones o guiones bajos.",
    "Display name must contain 1 to 100 characters": "El nombre debe tener entre 1 y 100 caracteres.",
    "Password must contain at least 10 characters and at most 72 UTF-8 bytes":
        "La contraseña debe tener al menos 10 caracteres y un máximo de 72 bytes UTF-8. Los acentos y emojis ocupan más de un byte."
};

export function errorMessage(error) {
    if (error.status === 0) return error.message;
    return validationMessages[error.message] ?? "No pudimos completar la solicitud. Inténtalo de nuevo en unos momentos.";
}
