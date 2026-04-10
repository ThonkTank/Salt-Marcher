package features.creatures.identity.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record UpsertAliasInput(
        Connection connection,
        String sourceSlug,
        String slugKey,
        Long externalId,
        Long localId
) {
}
