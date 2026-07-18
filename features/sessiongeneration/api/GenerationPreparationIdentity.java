package features.sessiongeneration.api;

import java.util.Objects;

/** Opaque caller-owned identity for one preparation attempt. */
public record GenerationPreparationIdentity(String value) {

    private static final GenerationPreparationIdentity LEGACY = new GenerationPreparationIdentity("legacy");

    public GenerationPreparationIdentity {
        value = Objects.requireNonNull(value, "value").trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("preparation identity must not be empty");
        }
    }

    /** Temporary identity used only by the M3-bound compatibility generation caller. */
    public static GenerationPreparationIdentity legacy() {
        return LEGACY;
    }
}
