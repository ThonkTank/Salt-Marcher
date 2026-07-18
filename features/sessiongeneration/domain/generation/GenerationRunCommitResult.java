package features.sessiongeneration.domain.generation;

import java.util.Objects;

public record GenerationRunCommitResult(GeneratedRunDraft draft, Outcome outcome) {

    public GenerationRunCommitResult {
        draft = Objects.requireNonNull(draft, "draft");
        outcome = Objects.requireNonNull(outcome, "outcome");
    }

    public enum Outcome {
        INSERTED,
        ALREADY_PRESENT
    }
}
