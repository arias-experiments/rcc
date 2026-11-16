const version = "4.6.1";
const source = "https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js";
const integrity = "sha384-Emf5ZVIUiarAdhkgtqK+5/Z5qIvM6QoVrS+qAVtfyZVuD5lIHrac0me485+Antp0";
let pending;

export async function loadChartLibrary() {
    if (window.Chart?.version === version) return window.Chart;
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = source;
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
        script.referrerPolicy = "no-referrer";
        script.async = true;
        const fail = () => {
            clearTimeout(timeout);
            script.remove();
            reject(new Error("Chart library unavailable"));
        };
        const timeout = setTimeout(fail, 15000);
        script.onerror = fail;
        script.onload = () => {
            clearTimeout(timeout);
            if (window.Chart?.version === version) resolve(window.Chart);
            else fail();
        };
        document.head.append(script);
    });
    try { return await pending; }
    finally { pending = null; }
}
