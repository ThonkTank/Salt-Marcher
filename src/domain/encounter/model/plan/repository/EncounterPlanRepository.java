package src.domain.encounter.model.plan.repository;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;

public interface EncounterPlanRepository {

    EncounterPlan save(EncounterPlan plan);

    Optional<EncounterPlan> load(long planId);

    List<EncounterPlanSummary> list();
}
