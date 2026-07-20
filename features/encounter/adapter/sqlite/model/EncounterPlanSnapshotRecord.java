package features.encounter.adapter.sqlite.model;

import java.util.List;
import java.util.Optional;

public record EncounterPlanSnapshotRecord(
        EncounterPlanRecord plan,
        List<EncounterPlanCreatureRecord> creatures,
        Optional<GeneratedEncounterOriginRecord> origin
) {
    public EncounterPlanSnapshotRecord(
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) {
        this(plan, creatures, Optional.empty());
    }

    public EncounterPlanSnapshotRecord {
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        origin = origin == null ? Optional.empty() : origin;
    }
}
