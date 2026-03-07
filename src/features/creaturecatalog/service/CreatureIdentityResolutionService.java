package features.creaturecatalog.service;

import features.creaturecatalog.repository.CreatureIdentityLookupRepository;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Shared identity resolution policy for workflows that need to remap creature IDs safely.
 */
public final class CreatureIdentityResolutionService {
    private CreatureIdentityResolutionService() {
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
