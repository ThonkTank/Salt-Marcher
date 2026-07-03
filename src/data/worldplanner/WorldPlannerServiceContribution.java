package src.data.worldplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.worldplanner.repository.SqliteWorldPlannerRepository;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;

public final class WorldPlannerServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(WorldPlannerRepository.class, new SqliteWorldPlannerRepository());
    }
}
