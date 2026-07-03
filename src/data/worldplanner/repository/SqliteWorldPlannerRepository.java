package src.data.worldplanner.repository;

import java.util.Objects;
import src.data.worldplanner.gateway.local.SqliteWorldPlannerLocalGateway;
import src.data.worldplanner.mapper.WorldPlannerMapper;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class SqliteWorldPlannerRepository implements WorldPlannerRepository {

    private final SqliteWorldPlannerLocalGateway gateway;

    public SqliteWorldPlannerRepository() {
        this(new SqliteWorldPlannerLocalGateway());
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
