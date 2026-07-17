package features.dungeon.adapter.sqlite.repository;

import platform.persistence.SqliteDatabase;
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteGateway;
import features.dungeon.adapter.sqlite.mapper.DungeonMapRecordMapper;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonChangeSet;
import features.dungeon.domain.core.structure.DungeonMapIdentity;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonViewportRequest;

public final class SqliteDungeonMapRepository implements DungeonMapRepository {

    private final DungeonSqliteGateway gateway;

    public SqliteDungeonMapRepository() {
        this(new DungeonSqliteGateway());
    }

    public SqliteDungeonMapRepository(SqliteDatabase database) {
        this(new DungeonSqliteGateway(database));
    }

    SqliteDungeonMapRepository(DungeonSqliteGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public DungeonMapIdentity nextMapId() {
        return new DungeonMapIdentity(gateway.nextMapId());
    }

    @Override
    public long nextStairId() {
        return gateway.nextStairId();
    }

    @Override
    public long nextTransitionId() {
        return gateway.nextTransitionId();
    }

    @Override
    public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
        if (mapId == null) {
            return Optional.empty();
        }
        return gateway.findMap(mapId.value()).map(DungeonMapRecordMapper::toDomain);
    }

    @Override
    public List<DungeonMap> searchByName(String query) {
        return gateway.searchMaps(query).stream()
                .map(DungeonMapRecordMapper::toDomain)
                .toList();
    }

    @Override
    public Optional<DungeonMap> firstMap() {
        return gateway.firstMap().map(DungeonMapRecordMapper::toDomain);
    }

    @Override
    public DungeonMap save(DungeonMap dungeonMap) {
        return DungeonMapRecordMapper.toDomain(gateway.saveMap(DungeonMapRecordMapper.toRecord(dungeonMap)));
    }

    @Override
    public DungeonMap saveChange(DungeonChangeSet changeSet) {
        DungeonChangeSet safeChangeSet = Objects.requireNonNull(changeSet, "changeSet");
        return DungeonMapRecordMapper.toDomain(gateway.saveChange(
                DungeonMapRecordMapper.toRecord(safeChangeSet.before()),
                DungeonMapRecordMapper.toRecord(safeChangeSet.after())));
    }

    @Override
    public List<DungeonMap> saveAll(List<DungeonMap> dungeonMaps) {
        if (dungeonMaps == null || dungeonMaps.isEmpty()) {
            return List.of();
        }
        return gateway.saveMaps(dungeonMaps.stream()
                        .map(DungeonMapRecordMapper::toRecord)
                        .toList())
                .stream()
                .map(DungeonMapRecordMapper::toDomain)
                .toList();
    }

    @Override
    public void delete(DungeonMapIdentity mapId) {
        if (mapId != null) {
            gateway.deleteMap(mapId.value());
        }
    }

    @Override
    public Set<DungeonChunkKey> findAvailableChunks(DungeonViewportRequest request) {
        return gateway.findAvailableChunks(request);
    }
}
