package src.data.dungeon.repository;

import src.data.dungeon.gateway.local.DungeonSqliteGateway;
import src.data.dungeon.mapper.DungeonMapRecordMapper;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapIdentity;

import java.util.Objects;
import java.util.Optional;

public final class SqliteDungeonMapRepository implements DungeonMapRepository {

    private final DungeonSqliteGateway gateway;

    public SqliteDungeonMapRepository() {
        this(new DungeonSqliteGateway());
    }

    SqliteDungeonMapRepository(DungeonSqliteGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public DungeonMapIdentity nextMapId() {
        return new DungeonMapIdentity(gateway.nextMapId());
    }

    @Override
    public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
        if (mapId == null) {
            return Optional.empty();
        }
        return gateway.findMap(mapId.value()).map(DungeonMapRecordMapper::toDomain);
    }

    @Override
    public DungeonMap save(DungeonMap dungeonMap) {
        return DungeonMapRecordMapper.toDomain(gateway.saveMap(DungeonMapRecordMapper.toRecord(dungeonMap)));
    }

    @Override
    public void delete(DungeonMapIdentity mapId) {
        if (mapId != null) {
            gateway.deleteMap(mapId.value());
        }
    }
}
