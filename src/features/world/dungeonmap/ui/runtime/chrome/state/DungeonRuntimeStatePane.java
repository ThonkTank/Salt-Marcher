package features.world.dungeonmap.ui.runtime.chrome.state;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

public final class DungeonRuntimeStatePane extends VBox {

    private final Label currentRoomLabel = new Label("-");
    private final Label currentAreaLabel = new Label("-");
    private final Label currentEndpointLabel = new Label("-");
    private final Label encounterProfileLabel = new Label("-");
    private final Label statusLabel = new Label("-");

    public DungeonRuntimeStatePane() {
        setSpacing(8);
        setPadding(new Insets(10));
        getStyleClass().add("dungeon-editor-card");

        Label title = new Label("Reise");
        title.getStyleClass().add("dungeon-panel-title");

        statusLabel.setWrapText(true);

        getChildren().addAll(
                title,
                sectionLabel("Aktueller Raum"),
                currentRoomLabel,
                sectionLabel("Aktueller Bereich"),
                currentAreaLabel,
                sectionLabel("Aktueller Übergang"),
                currentEndpointLabel,
                sectionLabel("Encounter-Profil"),
                encounterProfileLabel,
                sectionLabel("Status"),
                statusLabel);
    }

    public void showLocation(String roomName, String areaName, String encounterProfile, String endpointName, String statusText) {
        currentRoomLabel.setText(valueOrDash(roomName));
        currentAreaLabel.setText(valueOrDash(areaName));
        currentEndpointLabel.setText(valueOrDash(endpointName));
        encounterProfileLabel.setText(valueOrDash(encounterProfile));
        statusLabel.setText(valueOrDash(statusText));
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        return label;
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
