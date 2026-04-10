package features.creatures.identity.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record ResolveRecoveryIdInput(
        Connection connection,
        long creatureId,
        String sourceSlug,
        String slugKey,
        String creatureName
) {

    public record ResolvedRecoveryIdInput(long localId) {
    }
}
