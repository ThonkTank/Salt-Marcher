package features.sessiongeneration.api;

import java.util.Objects;
import java.util.Optional;

public record GenerationDraftResponse(
        GenerationStatus status,
        String message,
        Optional<GenerationDraft> draft
) {

    public GenerationDraftResponse {
        status = Objects.requireNonNull(status, "status");
        message = Objects.requireNonNullElse(message, "");
        draft = Objects.requireNonNull(draft, "draft");
        requirePayload(status, draft.isPresent());
    }

    public static GenerationDraftResponse success(GenerationDraft draft) {
        return new GenerationDraftResponse(GenerationStatus.SUCCESS, "", Optional.of(draft));
    }

    public static GenerationDraftResponse failure(GenerationStatus status, String message) {
        return new GenerationDraftResponse(status, message, Optional.empty());
    }

    private static void requirePayload(GenerationStatus status, boolean present) {
        if ((status == GenerationStatus.SUCCESS) != present) {
            throw new IllegalArgumentException("draft payload does not match response status");
        }
    }
}
