package src.data.dungeon.repository;

import platform.persistence.SqliteDatabase;
import src.data.dungeon.gateway.local.DungeonSqliteGateway;
import src.data.dungeon.mapper.DungeonMapRecordMapper;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

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
}
