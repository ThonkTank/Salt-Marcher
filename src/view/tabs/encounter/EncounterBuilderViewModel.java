package src.view.tabs.encounter;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.encounter.api.EncounterGenerationRequest;

public final class EncounterBuilderViewModel {

    private final EncounterApplicationService encounters;
    private final StringProperty result = new SimpleStringProperty("");

    public EncounterBuilderViewModel(EncounterApplicationService encounters) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
    }

    public ReadOnlyStringProperty resultProperty() {
        return result;
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
        result.set(String.valueOf(generatedEncounter));
    }
}
