package src.view.encounter.Model;

import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public final class EncounterAlternativeState {

    private final ObservableList<EncounterModel.EncounterAlternativeViewData> alternatives = FXCollections.observableArrayList();
    private final ObjectProperty<EncounterModel.EncounterAlternativeViewData> selectedAlternative = new SimpleObjectProperty<>();

    public ObservableList<EncounterModel.EncounterAlternativeViewData> alternatives() {
        return alternatives;
    }

    public ObjectProperty<EncounterModel.EncounterAlternativeViewData> selectedAlternativeProperty() {
        return selectedAlternative;
    }
}
