package features.sessiongeneration.api;

import java.util.Objects;

public record GenerationDraft(GenerationResult result, String contentFingerprint) {

    public GenerationDraft {
        result = Objects.requireNonNull(result, "result");
        contentFingerprint = Objects.requireNonNull(contentFingerprint, "contentFingerprint").trim();
        if (!contentFingerprint.matches("v1:[0-9a-f]{64}")) {
            throw new IllegalArgumentException("content fingerprint must use the v1 SHA-256 format");
        }
    }
}
