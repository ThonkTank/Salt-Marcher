package features.sessiongeneration.api;

import java.util.Objects;
import java.util.Optional;

public record GenerationResponse(
        GenerationStatus status,
        String message,
        Optional<GenerationResult> result
) {

    public GenerationResponse {
        status = Objects.requireNonNull(status, "status");
        message = Objects.requireNonNullElse(message, "");
        result = Objects.requireNonNull(result, "result");
        if (status == GenerationStatus.SUCCESS && result.isEmpty()) {
            throw new IllegalArgumentException("successful response requires a result");
        }
        if (status != GenerationStatus.SUCCESS && result.isPresent()) {
            throw new IllegalArgumentException("failed response must not expose a result");
        }
    }

    public static GenerationResponse success(GenerationResult result) {
        return new GenerationResponse(GenerationStatus.SUCCESS, "", Optional.of(result));
    }

    public static GenerationResponse failure(GenerationStatus status, String message) {
        return new GenerationResponse(status, message, Optional.empty());
    }
}
