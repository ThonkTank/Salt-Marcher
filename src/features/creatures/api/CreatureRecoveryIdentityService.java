package features.creatures.api;

import features.creatures.repository.identity.CreatureIdentityLookupRepository;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public identity resolution policy for encounter-table recovery.
 */
public final class CreatureRecoveryIdentityService {
    private CreatureRecoveryIdentityService() {
        throw new AssertionError("No instances");
    }

    public static long resolveEncounterRecoveryId(
            Connection conn,
            long creatureId,
            String sourceSlug,
            String slugKey,
            String creatureName) throws SQLException {
        if (CreatureIdentityLookupRepository.existsById(conn, creatureId)) {
            return creatureId;
        }
        long bySlug = CreatureIdentityLookupRepository.findUniqueBySourceSlug(conn, sourceSlug);
        if (bySlug > 0) {
            return bySlug;
        }
        long bySlugName = CreatureIdentityLookupRepository.findUniqueBySlugAndName(conn, slugKey, creatureName);
        if (bySlugName > 0) {
            return bySlugName;
        }
        return CreatureIdentityLookupRepository.findUniqueByName(conn, creatureName);
    }
}
