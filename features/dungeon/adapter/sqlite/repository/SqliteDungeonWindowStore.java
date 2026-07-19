package features.dungeon.adapter.sqlite.repository;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteWindowGateway;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowContentSource;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteDatabase;

/** Dedicated SQLite adapter for sparse windows and exact identity closure. */
public final class SqliteDungeonWindowStore implements DungeonWindowContentSource {

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
    public Optional<DungeonWindowIndex> loadIndex(DungeonWindowRequest request) {
        return gateway.loadIndex(request);
    }

    @Override
    public Optional<DungeonWindow> loadContent(DungeonWindowContentRequest request) {
        return gateway.loadContent(request);
    }

    @Override
    public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
        return gateway.loadIdentityClosure(request);
    }

    @Override
    public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
        return gateway.discoverInboundReferences(request);
    }

    @Override
    public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
        return gateway.locateTravelStart(request);
    }

    @Override
    public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
        return gateway.discoverTravelChunkKeys(request);
    }
}
