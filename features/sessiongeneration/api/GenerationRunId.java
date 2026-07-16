package features.sessiongeneration.api;

import java.util.Objects;

public record GenerationRunId(String value) {

    public GenerationRunId {
        value = Objects.requireNonNull(value, "value").trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("run id must not be empty");
        }
    }
}
