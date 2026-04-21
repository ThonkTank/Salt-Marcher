package src.data.dungeon.query;

import src.data.dungeon.gateway.local.DungeonSqliteGateway;
import src.data.dungeon.mapper.DungeonMapRecordMapper;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapSearch;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class SqliteDungeonMapSearch implements DungeonMapSearch {

    private final DungeonSqliteGateway gateway;

    public SqliteDungeonMapSearch() {
        this(new DungeonSqliteGateway());
    }

    SqliteDungeonMapSearch(DungeonSqliteGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
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
}
