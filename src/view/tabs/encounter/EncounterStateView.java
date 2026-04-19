package src.view.tabs.encounter;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class EncounterStateView extends VBox {

    private final Label state = new Label();

    public EncounterStateView() {
        setSpacing(8);
        setPadding(new Insets(12));
        getStyleClass().add("surface-root");

        Label title = new Label("Encounter state");
        state.setWrapText(true);
        getChildren().addAll(title, state);
    }

    public StringProperty stateTextProperty() {
        return state.textProperty();
    }
}
