package features.encounter.adapter.sqlite.mapper;

import java.util.List;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encounter.domain.plan.EncounterPlanSummary;

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
