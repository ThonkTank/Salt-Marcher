package features.sessiongeneration.api;

import java.util.Objects;

/** Opaque caller-owned identity for one preparation attempt. */
public record GenerationPreparationIdentity(String value) {

    public GenerationPreparationIdentity {
        value = Objects.requireNonNull(value, "value").trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("preparation identity must not be empty");
        }
    }

}
