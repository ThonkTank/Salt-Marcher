package features.sessiongeneration.domain.generation;

import java.util.Objects;

/** Complete transient generation truth before it is committed as an immutable run. */
public record GeneratedRunDraft(GeneratedRun run, String contentFingerprint) {

    public GeneratedRunDraft {
        run = Objects.requireNonNull(run, "run");
        contentFingerprint = Objects.requireNonNull(contentFingerprint, "contentFingerprint").trim();
        if (!contentFingerprint.matches("v1:[0-9a-f]{64}")) {
            throw new IllegalArgumentException("content fingerprint must use the v1 SHA-256 format");
        }
    }

    public static GeneratedRunDraft from(GeneratedRun run) {
        return new GeneratedRunDraft(run, GenerationContentFingerprint.v1(run));
    }
}
