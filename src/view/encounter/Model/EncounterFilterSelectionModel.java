package src.view.encounter.Model;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

public final class EncounterFilterSelectionModel {

    private final ObservableList<String> selectedTypes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedSubtypes = FXCollections.observableArrayList();
    private final ObservableList<String> selectedBiomes = FXCollections.observableArrayList();

    public ObservableList<String> selectedTypes() {
        return selectedTypes;
    }

    public ObservableList<String> selectedSubtypes() {
        return selectedSubtypes;
    }

    public ObservableList<String> selectedBiomes() {
        return selectedBiomes;
    }

    public void clear() {
        selectedTypes.clear();
        selectedSubtypes.clear();
        selectedBiomes.clear();
    }
}
