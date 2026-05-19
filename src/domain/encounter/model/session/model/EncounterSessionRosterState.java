package src.domain.encounter.model.session.model;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.session.model.EncounterCreatureData;
import src.domain.encounter.model.session.model.RemovedRosterEntryData;

record EncounterSessionRosterState(
        List<EncounterCreatureData> creatures,
        Optional<RemovedRosterEntryData> pendingUndo
) {
    EncounterSessionRosterState {
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
    }
}
