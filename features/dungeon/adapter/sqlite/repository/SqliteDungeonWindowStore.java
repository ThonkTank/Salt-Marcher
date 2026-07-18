package features.dungeon.adapter.sqlite.repository;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteWindowGateway;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteDatabase;

/** Dedicated SQLite adapter for sparse windows and exact identity closure. */
public final class SqliteDungeonWindowStore implements DungeonWindowStore {

    private final DungeonSqliteWindowGateway gateway;

    public SqliteDungeonWindowStore() {
        this(new DungeonSqliteWindowGateway());
    }

    public SqliteDungeonWindowStore(SqliteDatabase database) {
        this(new DungeonSqliteWindowGateway(database));
    }

    SqliteDungeonWindowStore(DungeonSqliteWindowGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
        return gateway.loadWindow(request);
    }

    @Override
    public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
        return gateway.loadIdentityClosure(request);
    }
}
