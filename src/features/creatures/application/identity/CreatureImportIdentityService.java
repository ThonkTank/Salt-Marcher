package features.creatures.application.identity;

import features.creatures.identity.IdentityObject;
import features.creatures.identity.input.ResolveImportIdInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Set;

/**
 * Resolves stable local creature IDs for imported source entities.
 */
@SuppressWarnings("unused")
public final class CreatureImportIdentityService {
    private static final IdentityObject IDENTITY_OBJECT = new IdentityObject();

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
        ResolveImportIdInput.ResolvedImportIdInput resolved = IDENTITY_OBJECT.resolveImportId(
                new ResolveImportIdInput(conn, externalId, sourceSlug, slugKey, name, reservedIds));
        return new ImportIdResolution(resolved.localId(), resolved.driftReason());
    }
}
