package features.dungeon.adapter.sqlite.repository;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteGateway;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import platform.persistence.FeatureStoreHandle;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Metadata-only SQLite catalog adapter for authored Dungeon maps. */
public final class SqliteDungeonCatalogStore implements DungeonCatalogStore {

    private final DungeonSqliteGateway gateway;

    public SqliteDungeonCatalogStore(FeatureStoreHandle store) {
        this(new DungeonSqliteGateway(store));
    }

    SqliteDungeonCatalogStore(DungeonSqliteGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public List<DungeonMapHeader> search(String query) {
        return gateway.searchMapHeaders(query);
    }

    @Override
    public Optional<DungeonMapHeader> find(DungeonMapIdentity mapId) {
        return mapId == null ? Optional.empty() : gateway.findMapHeader(mapId.value());
    }

    @Override
    public Optional<DungeonMapHeader> first() {
        return gateway.firstMapHeader();
    }

    @Override
    public DungeonMapHeader create(String mapName) {
        return gateway.createMapHeader(mapName);
    }

    @Override
    public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
        return gateway.renameMapHeader(Objects.requireNonNull(mapId, "mapId").value(), mapName);
    }

    @Override
    public void delete(DungeonMapIdentity mapId) {
        if (mapId != null) {
            gateway.deleteMap(mapId.value());
        }
    }
}
