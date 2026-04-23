package src.data.encounter.model;

import java.util.List;

public record EncounterPlanSnapshotRecord(
        EncounterPlanRecord plan,
        List<EncounterPlanCreatureRecord> creatures
) {
    public EncounterPlanSnapshotRecord {
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
    }
}
