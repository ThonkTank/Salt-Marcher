package features.encounter.adapter.sqlite.mapper;

import java.util.List;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanSnapshotRecord;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.encounter.domain.plan.EncounterPlanSummary;
import features.encounter.domain.plan.GeneratedEncounterOrigin;

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
                        .map(record -> new EncounterPlanCreature(
                                record.creatureId(), record.quantity(), record.lastKnownDisplayName()))
                        .toList(),
                java.util.Optional.empty());
    }

    public static EncounterPlan toDomainPlan(EncounterPlanSnapshotRecord snapshot) {
        return new EncounterPlan(
                snapshot.plan().id(),
                snapshot.plan().name(),
                snapshot.plan().generatedLabel(),
                snapshot.creatures().stream()
                        .map(record -> new EncounterPlanCreature(
                                record.creatureId(), record.quantity(), record.lastKnownDisplayName()))
                        .toList(),
                snapshot.origin().map(origin -> new GeneratedEncounterOrigin(
                        origin.engineVersion(),
                        origin.preparationIdentity(),
                        origin.generationRunIdentity(),
                        origin.batchFingerprint(),
                        origin.batchCardinality(),
                        origin.batchOrder(),
                        origin.encounterNumber(),
                        origin.intentFingerprint(),
                        origin.rosterFingerprint())));
    }

    public static EncounterPlanSummary toDomainSummary(EncounterPlanRecord plan) {
        return new EncounterPlanSummary(
                plan.id(),
                plan.name(),
                plan.generatedLabel(),
                plan.creatureCount());
    }
}
