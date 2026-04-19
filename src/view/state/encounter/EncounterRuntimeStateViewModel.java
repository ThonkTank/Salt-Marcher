package src.view.state.encounter;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;

public final class EncounterRuntimeStateViewModel {

    private final EncounterApplicationService encounters;
    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");

    public EncounterRuntimeStateViewModel(EncounterApplicationService encounters) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
    }

    public ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    public void generate() {
        var generatedEncounter = encounters.generate(new EncounterGenerationRequest(
                List.of(),
                List.of(),
                List.of(),
                EncounterDifficultyBand.defaultBand(),
                5,
                List.of(),
                List.of()));
        state.set("Encounter request sent through EncounterApplicationService: "
                + String.valueOf(generatedEncounter));
    }
}
