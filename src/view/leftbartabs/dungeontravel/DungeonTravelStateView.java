package src.view.leftbartabs.dungeontravel;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonTravelStateView extends VBox {

    private final Label body = new Label();

    public DungeonTravelStateView() {
        setSpacing(12);
        setPadding(new Insets(12));
        getStyleClass().addAll("surface-root", "dungeon-editor-sidebar");

        Label title = new Label("Travel state");
        title.getStyleClass().add("editor-panel-title");
        body.setWrapText(true);
        VBox card = new VBox(6, title, body);
        card.getStyleClass().add("editor-card");
        getChildren().add(card);
    }

    public StringProperty stateTextProperty() {
        return body.textProperty();
    }
}
