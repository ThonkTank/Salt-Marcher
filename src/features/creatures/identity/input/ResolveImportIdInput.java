package features.creatures.identity.input;

import java.sql.Connection;
import java.util.Set;

@SuppressWarnings("unused")
public record ResolveImportIdInput(
        Connection connection,
        Long externalId,
        String sourceSlug,
        String slugKey,
        String name,
        Set<Long> reservedIds
) {

    public record ResolvedImportIdInput(Long localId, String driftReason) {
    }
}
