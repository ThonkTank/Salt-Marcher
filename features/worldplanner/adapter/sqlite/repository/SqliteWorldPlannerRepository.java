package features.worldplanner.adapter.sqlite.repository;

import features.worldplanner.adapter.sqlite.gateway.local.SqliteWorldPlannerLocalGateway;
import features.worldplanner.adapter.sqlite.mapper.WorldPlannerMapper;
import features.worldplanner.domain.world.WorldPlannerState;
import features.worldplanner.domain.world.repository.WorldPlannerRepository;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

import java.util.Objects;

public final class SqliteWorldPlannerRepository implements WorldPlannerRepository {

    private final SqliteWorldPlannerLocalGateway gateway;

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteWorldPlannerLocalGateway.storeDefinition();
    }

    public SqliteWorldPlannerRepository(FeatureStoreHandle store) {
        this(new SqliteWorldPlannerLocalGateway(store));
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
