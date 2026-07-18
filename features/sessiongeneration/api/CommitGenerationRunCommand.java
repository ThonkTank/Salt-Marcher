package features.sessiongeneration.api;

import java.util.Objects;

public record CommitGenerationRunCommand(GenerationDraft draft) {

    public CommitGenerationRunCommand {
        draft = Objects.requireNonNull(draft, "draft");
    }
}
