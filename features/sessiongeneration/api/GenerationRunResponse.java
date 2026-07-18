package features.sessiongeneration.api;

import java.util.Objects;
import java.util.Optional;

public record GenerationRunResponse(
        GenerationStatus status,
        String message,
        Optional<GenerationResult> result,
        Optional<CommitOutcome> commitOutcome
) {

    public GenerationRunResponse {
        status = Objects.requireNonNull(status, "status");
        message = Objects.requireNonNullElse(message, "");
        result = Objects.requireNonNull(result, "result");
        commitOutcome = Objects.requireNonNull(commitOutcome, "commitOutcome");
        if ((status == GenerationStatus.SUCCESS) != result.isPresent()) {
            throw new IllegalArgumentException("run payload does not match response status");
        }
        if (status != GenerationStatus.SUCCESS && commitOutcome.isPresent()) {
            throw new IllegalArgumentException("failed run response must not expose a commit outcome");
        }
    }

    public static GenerationRunResponse success(GenerationResult result) {
        return new GenerationRunResponse(GenerationStatus.SUCCESS, "", Optional.of(result), Optional.empty());
    }

    public static GenerationRunResponse committed(GenerationResult result, CommitOutcome outcome) {
        return new GenerationRunResponse(
                GenerationStatus.SUCCESS, "", Optional.of(result), Optional.of(outcome));
    }

    public static GenerationRunResponse failure(GenerationStatus status, String message) {
        return new GenerationRunResponse(status, message, Optional.empty(), Optional.empty());
    }

    public enum CommitOutcome {
        INSERTED,
        ALREADY_PRESENT
    }
}
