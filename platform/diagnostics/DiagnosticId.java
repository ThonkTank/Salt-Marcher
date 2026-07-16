package platform.diagnostics;

import java.util.Objects;

public record DiagnosticId(String value) {

    public DiagnosticId {
        value = Objects.requireNonNull(value, "value");
        if (!value.matches("[a-z0-9]+(?:[.-][a-z0-9]+)*")) {
            throw new IllegalArgumentException("diagnostic id must be a stable lowercase code");
        }
    }
}
