package features.worldplanner.adapter.sqlite.repository;

import java.util.Objects;
import platform.persistence.SqliteDatabase;
import features.worldplanner.adapter.sqlite.gateway.local.SqliteWorldPlannerLocalGateway;
import features.worldplanner.adapter.sqlite.mapper.WorldPlannerMapper;
import features.worldplanner.domain.world.WorldPlannerState;
import features.worldplanner.domain.world.repository.WorldPlannerRepository;

public final class SqliteWorldPlannerRepository implements WorldPlannerRepository {

    private final SqliteWorldPlannerLocalGateway gateway;

    public SqliteWorldPlannerRepository() {
        this(new SqliteWorldPlannerLocalGateway());
    }

    public SqliteWorldPlannerRepository(SqliteDatabase database) {
        this(new SqliteWorldPlannerLocalGateway(database));
    }

    SqliteWorldPlannerRepository(SqliteWorldPlannerLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public WorldPlannerState load() {
        return WorldPlannerMapper.toDomain(gateway.load());
    }

    @Override
    public WorldPlannerState save(WorldPlannerState state) {
        WorldPlannerState savedState = WorldPlannerMapper.toDomain(gateway.save(WorldPlannerMapper.toRecord(state)));
        return savedState.withStatus(state == null ? "" : state.statusText());
    }
}
