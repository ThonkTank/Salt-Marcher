package features.creatures.api;

import features.creatures.identity.IdentityObject;
import features.creatures.identity.input.ResolveRecoveryIdInput;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public identity resolution policy for encounter-table recovery.
 */
@SuppressWarnings("unused")
public final class CreatureRecoveryIdentityService {
    private static final IdentityObject IDENTITY_OBJECT = new IdentityObject();

    private CreatureRecoveryIdentityService() {
        throw new AssertionError("No instances");
    }

    public static long resolveEncounterRecoveryId(
            Connection conn,
            long creatureId,
            String sourceSlug,
            String slugKey,
            String creatureName) throws SQLException {
        return IDENTITY_OBJECT.resolveRecoveryId(
                new ResolveRecoveryIdInput(conn, creatureId, sourceSlug, slugKey, creatureName)).localId();
    }
}
