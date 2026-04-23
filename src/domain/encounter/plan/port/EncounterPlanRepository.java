package src.domain.encounter.plan.port;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.plan.aggregate.EncounterPlan;
import src.domain.encounter.plan.value.EncounterPlanSummary;

public interface EncounterPlanRepository {

    EncounterPlan save(EncounterPlan plan);

    Optional<EncounterPlan> load(long planId);

    List<EncounterPlanSummary> list();
}
