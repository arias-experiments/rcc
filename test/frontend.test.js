import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import app from "../src/app.js";

// Public pages contain no private record data; browser modules check the session.
test("buildless frontend routes and shared modules are served", async (t) => {
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [route, title] of [["/", "Registro diario"], ["/historial", "Historial"], ["/graficas", "Gráficas"], ["/login", "Iniciar sesión"], ["/register", "Crear cuenta"]]) {
        await t.test(`GET ${route} serves its HTML page without caching`, async () => {
            const response = await fetch(`${base}${route}`);
            assert.equal(response.status, 200);
            assert.match(response.headers.get("content-type"), /text\/html/);
            assert.equal(response.headers.get("cache-control"), "no-store");
            assert.ok((await response.text()).includes(`<title>${title} · RCC</title>`));
        });
    }
    await t.test("shared browser modules and stylesheet need no build", async () => {
        for (const asset of ["/js/charts.js", "/js/charts-data.js", "/js/chart-library.js", "/js/history.js", "/js/app-shell.js", "/js/record-form.js", "/js/record-form-view.js", "/css/styles.css"]) {
            const response = await fetch(`${base}${asset}`);
            assert.equal(response.status, 200);
            assert.match(response.headers.get("content-type"), asset.endsWith(".css") ? /text\/css/ : /javascript/);
            assert.ok((await response.text()).length > 0);
        }
    });
});
