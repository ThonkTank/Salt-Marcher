package features.creatures.application.identity;

import features.creatures.repository.identity.CreatureIdentityLookupRepository;
import features.creatures.repository.identity.CreatureImportAliasRepository;
import features.creatures.repository.identity.CreatureImportIdentityRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Set;

/**
 * Resolves stable local creature IDs for imported source entities.
 */
public final class CreatureImportIdentityService {
    private CreatureImportIdentityService() {
        throw new AssertionError("No instances");
    }

    public record ImportIdResolution(Long localId, String driftReason) {}

    public static ImportIdResolution resolveImportId(
            Connection conn,
            Long externalId,
            String sourceSlug,
            String slugKey,
            String name,
            Set<Long> reservedIds) throws SQLException {
        Long aliasId = CreatureImportAliasRepository.findLocalIdBySourceSlug(conn, sourceSlug);
        if (aliasId != null && aliasId > 0) return new ImportIdResolution(aliasId, null);

        long sameSource = CreatureIdentityLookupRepository.findUniqueBySourceSlug(conn, sourceSlug);
        if (sameSource > 0) return new ImportIdResolution(sameSource, null);

        long sameSlugAndName = CreatureIdentityLookupRepository.findUniqueBySlugAndName(conn, slugKey, name);
        if (sameSlugAndName > 0) return new ImportIdResolution(sameSlugAndName, null);

        if (externalId == null) {
            Long reassigned = CreatureImportIdentityRepository.nextAvailableId(conn, reservedIds);
            return new ImportIdResolution(reassigned, "missing-external-id");
        }

        CreatureImportIdentityRepository.CreatureIdentity existingAtExternal =
                CreatureImportIdentityRepository.loadCreatureIdentity(conn, externalId);
        if (existingAtExternal == null) {
            return new ImportIdResolution(externalId, null);
        }

        if (identityCompatible(existingAtExternal, sourceSlug, slugKey, name)) {
            return new ImportIdResolution(externalId, null);
        }

        Long reassigned = CreatureImportIdentityRepository.nextAvailableId(conn, reservedIds);
        String reason = "external-id-conflict existing(id=" + externalId
                + ",name=" + safe(existingAtExternal.name())
                + ",source_slug=" + safe(existingAtExternal.sourceSlug())
                + ",slug_key=" + safe(existingAtExternal.slugKey()) + ")";
        return new ImportIdResolution(reassigned, reason);
    }

    private static boolean identityCompatible(
            CreatureImportIdentityRepository.CreatureIdentity existing,
            String sourceSlug,
            String slugKey,
            String name) {
        if (existing == null) return false;
        if (sourceSlug != null && sourceSlug.equals(existing.sourceSlug())) return true;
        if (slugKey != null && slugKey.equals(existing.slugKey())
                && name != null && name.equals(existing.name())) {
            return true;
        }
        return name != null && name.equals(existing.name())
                && existing.sourceSlug() == null
                && existing.slugKey() == null;
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
