package src.domain.encounter.model.session;

import java.util.List;
import java.util.Optional;

record EncounterSessionRosterState(
        List<EncounterCreatureData> creatures,
        Optional<RemovedRosterEntryData> pendingUndo
) {
    EncounterSessionRosterState {
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
    }
}
