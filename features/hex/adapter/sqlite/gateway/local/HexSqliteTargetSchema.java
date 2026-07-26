package features.hex.adapter.sqlite.gateway.local;

import features.hex.adapter.sqlite.model.HexPersistenceSchema;
import java.util.List;
import platform.persistence.SqliteSchemaValidator;

final class HexSqliteTargetSchema {

    private HexSqliteTargetSchema() {
    }

    static SqliteSchemaValidator validator() {
        return SqliteSchemaValidator.exactSchema(
                HexPersistenceSchema.CREATE_TABLE_SQL,
                HexPersistenceSchema.CREATE_INDEX_SQL,
                List.of("hex_", "idx_hex_", "sm_hex_"),
                List.of());
    }
}
