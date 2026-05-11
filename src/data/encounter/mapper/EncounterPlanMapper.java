package src.data.encounter.mapper;

import java.util.List;
import src.data.encounter.model.EncounterPlanCreatureRecord;
import src.data.encounter.model.EncounterPlanRecord;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.model.EncounterPlanCreature;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;

public final class EncounterPlanMapper {

    private EncounterPlanMapper() {
    }

    public static EncounterPlan toDomainPlan(
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) {
        return new EncounterPlan(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                creatures.stream()
                        .map(record -> new EncounterPlanCreature(record.creatureId(), record.quantity()))
                        .toList());
    }

    public static EncounterPlanSummary toDomainSummary(EncounterPlanRecord plan) {
        return new EncounterPlanSummary(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatureCount());
    }
}
