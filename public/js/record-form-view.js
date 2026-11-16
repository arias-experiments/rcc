// Shared static markup; user-entered values are never interpolated into HTML.
export function renderRecordForm(container, { editing = false } = {}) {
    container.innerHTML = `<form id="record-form" method="post" action="/api/records" novalidate autocomplete="off">
                <fieldset id="record-fields" disabled>
                    <legend class="sr-only">Nuevo registro diario</legend>
                    <div class="record-heading">
                        <div><p class="eyebrow">TU BIENESTAR, DÍA A DÍA</p>
                            <h1>Registro diario</h1><p class="muted">Un momento para escuchar cómo te sientes.</p></div>
                        <div class="date-control"><label for="recordedAt">Fecha y hora</label>
                            <input type="datetime-local" id="recordedAt" name="recordedAt" required aria-describedby="recordedAt-error">
                            <p id="recordedAt-error" class="field-error" hidden></p></div>
                    </div>
                    <section class="metric-grid" aria-label="Mediciones">
                        <div class="record-card metric-card">
                            <label for="glicemia">Glicemia</label>
                            <div class="measurement-input"><input type="number" id="glicemia" name="glicemia" step="any" min="0" inputmode="decimal" placeholder="—" aria-describedby="glicemia-unit glicemia-error"><span id="glicemia-unit">mg/dL</span></div>
                            <p id="glicemia-error" class="field-error" hidden></p>
                        </div>
                        <div class="record-card metric-card">
                            <label for="cetonemia">Cetonemia</label>
                            <div class="measurement-input"><input type="number" id="cetonemia" name="cetonemia" step="any" min="0" inputmode="decimal" placeholder="—" aria-describedby="cetonemia-unit cetonemia-error"><span id="cetonemia-unit">mmol/L</span></div>
                            <p id="cetonemia-error" class="field-error" hidden></p>
                        </div>
                        <div class="record-card metric-card">
                            <label for="horasAyuno">Horas de ayuno</label>
                            <div class="measurement-input"><input type="number" id="horasAyuno" name="horasAyuno" step="any" min="0" inputmode="decimal" placeholder="—" aria-describedby="horasAyuno-unit horasAyuno-error"><span id="horasAyuno-unit">horas</span></div>
                            <p id="horasAyuno-error" class="field-error" hidden></p>
                        </div>
                    </section>
                    <section class="record-card feelings-card" aria-labelledby="feelings-title">
                        <h2 id="feelings-title">¿Cómo te sientes hoy?</h2>
                        <p class="muted section-help">Elige una intensidad del 1 al 5. Puedes dejar cualquier indicador sin seleccionar.</p>
                        <div class="gauge-scale" aria-hidden="true"><span>1 · Menor intensidad</span><span>5 · Mayor intensidad</span></div>
                        <div class="gauges">
                            <fieldset class="gauge-row" aria-describedby="dolor-error"><legend>Dolor</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="dolor" value="1" aria-label="Dolor: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="dolor" value="2" aria-label="Dolor: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="dolor" value="3" aria-label="Dolor: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="dolor" value="4" aria-label="Dolor: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="dolor" value="5" aria-label="Dolor: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="dolor" value="" checked aria-label="Dolor: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="dolor-error" class="field-error" hidden></p></fieldset>
                            <fieldset class="gauge-row" aria-describedby="anergia-error"><legend>Anergia</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="anergia" value="1" aria-label="Anergia: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="anergia" value="2" aria-label="Anergia: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="anergia" value="3" aria-label="Anergia: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="anergia" value="4" aria-label="Anergia: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="anergia" value="5" aria-label="Anergia: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="anergia" value="" checked aria-label="Anergia: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="anergia-error" class="field-error" hidden></p></fieldset>
                            <fieldset class="gauge-row" aria-describedby="fatiga-error"><legend>Fatiga</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="fatiga" value="1" aria-label="Fatiga: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="fatiga" value="2" aria-label="Fatiga: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="fatiga" value="3" aria-label="Fatiga: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="fatiga" value="4" aria-label="Fatiga: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="fatiga" value="5" aria-label="Fatiga: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="fatiga" value="" checked aria-label="Fatiga: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="fatiga-error" class="field-error" hidden></p></fieldset>
                            <fieldset class="gauge-row" aria-describedby="inatencion-error"><legend>Inatención</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="inatencion" value="1" aria-label="Inatención: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="inatencion" value="2" aria-label="Inatención: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="inatencion" value="3" aria-label="Inatención: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="inatencion" value="4" aria-label="Inatención: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="inatencion" value="5" aria-label="Inatención: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="inatencion" value="" checked aria-label="Inatención: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="inatencion-error" class="field-error" hidden></p></fieldset>
                            <fieldset class="gauge-row" aria-describedby="estres-error"><legend>Estrés</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="estres" value="1" aria-label="Estrés: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="estres" value="2" aria-label="Estrés: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="estres" value="3" aria-label="Estrés: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="estres" value="4" aria-label="Estrés: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="estres" value="5" aria-label="Estrés: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="estres" value="" checked aria-label="Estrés: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="estres-error" class="field-error" hidden></p></fieldset>
                            <fieldset class="gauge-row" aria-describedby="somnolencia-error"><legend>Somnolencia</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="somnolencia" value="1" aria-label="Somnolencia: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="somnolencia" value="2" aria-label="Somnolencia: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="somnolencia" value="3" aria-label="Somnolencia: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="somnolencia" value="4" aria-label="Somnolencia: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="somnolencia" value="5" aria-label="Somnolencia: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="somnolencia" value="" checked aria-label="Somnolencia: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="somnolencia-error" class="field-error" hidden></p></fieldset>
                            <fieldset class="gauge-row" aria-describedby="insomnio-error"><legend>Insomnio</legend><div class="gauge-options">
                                <label class="gauge-option"><input type="radio" name="insomnio" value="1" aria-label="Insomnio: 1"><span>1</span></label>
                                <label class="gauge-option"><input type="radio" name="insomnio" value="2" aria-label="Insomnio: 2"><span>2</span></label>
                                <label class="gauge-option"><input type="radio" name="insomnio" value="3" aria-label="Insomnio: 3"><span>3</span></label>
                                <label class="gauge-option"><input type="radio" name="insomnio" value="4" aria-label="Insomnio: 4"><span>4</span></label>
                                <label class="gauge-option"><input type="radio" name="insomnio" value="5" aria-label="Insomnio: 5"><span>5</span></label>
                                <label class="gauge-option gauge-unset"><input type="radio" name="insomnio" value="" checked aria-label="Insomnio: sin seleccionar"><span>Sin seleccionar</span></label>
                            </div><p id="insomnio-error" class="field-error" hidden></p></fieldset>
                        </div>
                    </section>
                    <section class="record-card comment-card">
                        <label for="comentario">Comentario</label>
                        <p id="comment-help" class="muted section-help">Si quieres, añade algo más sobre tu día.</p>
                        <textarea id="comentario" name="comentario" rows="4" aria-describedby="comment-help comment-count comentario-error" placeholder="¿Hay algo que te gustaría anotar?"></textarea>
                        <p id="comment-count" class="character-count" aria-live="polite" aria-atomic="true">0 / 500</p>
                        <p id="comentario-error" class="field-error" hidden></p>
                    </section>
                    <div class="record-actions"><button id="clear-record" class="secondary-button" type="button">Limpiar</button><button id="save-record" class="primary-button" type="submit">Guardar registro</button></div>
                </fieldset>
                <p id="record-error" class="error" role="alert" hidden></p>
                <p id="record-success" class="success-message" role="status" hidden></p>
            </form>`;
    if (editing) {
        container.querySelector(".record-heading > div:first-child").remove();
        container.querySelector("#record-fields > legend").textContent = "Editar registro";
        container.querySelector("#clear-record").textContent = "Cancelar";
        container.querySelector("#save-record").textContent = "Guardar cambios";
    }
    return container.querySelector("form");
}
