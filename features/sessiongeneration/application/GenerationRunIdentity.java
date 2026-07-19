package features.sessiongeneration.application;

import features.sessiongeneration.api.GenerationPreparationIdentity;
import features.sessiongeneration.domain.generation.GeneratedRun;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

final class GenerationRunIdentity {

    private GenerationRunIdentity() {
    }

    static String assign(GenerationPreparationIdentity preparationIdentity, GeneratedRun generated) {
        String canonical = "session-generation-run-v1\n"
                + preparationIdentity.value().replace("\r\n", "\n").replace('\r', '\n') + "\n"
                + generated.engineVersion() + "\n"
                + generated.catalogContentHash();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
