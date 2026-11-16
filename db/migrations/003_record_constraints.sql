ALTER TABLE rcc_records
    ADD CONSTRAINT chk_glicemia_positive
        CHECK (glicemia > 0),
    ADD CONSTRAINT chk_cetonemia_nonnegative
        CHECK (cetonemia >= 0),
    ADD CONSTRAINT chk_horas_ayuno_nonnegative
        CHECK (horas_ayuno >= 0),
    ADD CONSTRAINT chk_comentario_length
        CHECK (char_length(comentario) <= 500);
