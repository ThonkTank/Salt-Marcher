package features.dungeon.adapter.sqlite.repository;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteIdentityGateway;
import features.dungeon.application.authored.port.DungeonIdentityAllocator;
import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import java.util.Objects;
import platform.persistence.SqliteDatabase;

public final class SqliteDungeonIdentityAllocator implements DungeonIdentityAllocator {
    private final DungeonSqliteIdentityGateway gateway;

    public SqliteDungeonIdentityAllocator(SqliteDatabase database) {
        this(new DungeonSqliteIdentityGateway(database));
    }

    SqliteDungeonIdentityAllocator(DungeonSqliteIdentityGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public DungeonIdentityRange reserve(DungeonIdentityKind kind, int count) {
        return gateway.reserve(kind, count);
    }
}
