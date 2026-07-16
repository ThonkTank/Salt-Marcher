package features.encounter.domain.plan.repository;

import java.util.List;
import java.util.Optional;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanSummary;

public interface EncounterPlanRepository {

    EncounterPlan save(EncounterPlan plan);

    Optional<EncounterPlan> load(long planId);

    List<EncounterPlanSummary> list();
}
