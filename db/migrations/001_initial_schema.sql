CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE rcc_records (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    glicemia NUMERIC(6,2),
    cetonemia NUMERIC(6,2),
    horas_ayuno NUMERIC(5,2),

    dolor SMALLINT
        CHECK (dolor BETWEEN 1 AND 5),

    anergia SMALLINT
        CHECK (anergia BETWEEN 1 AND 5),

    fatiga SMALLINT
        CHECK (fatiga BETWEEN 1 AND 5),

    inatencion SMALLINT
        CHECK (inatencion BETWEEN 1 AND 5),

    estres SMALLINT
        CHECK (estres BETWEEN 1 AND 5),

    somnolencia SMALLINT
        CHECK (somnolencia BETWEEN 1 AND 5),

    insomnio SMALLINT
        CHECK (insomnio BETWEEN 1 AND 5),

    comentario TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_rcc_records_user_id
    ON rcc_records(user_id);


CREATE INDEX idx_rcc_records_user_recorded_at
    ON rcc_records(user_id, recorded_at DESC);

