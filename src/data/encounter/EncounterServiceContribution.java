package src.data.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;

public final class EncounterServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(EncounterPlanRepository.class, new SqliteEncounterPlanRepository());
    }
}
