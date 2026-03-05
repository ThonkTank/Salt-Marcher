package ui.overworld;

import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * ScenePane content for overworld travel mode.
 * Placeholder mockup showing travel context (location, status, weather, etc.).
 * All displayed values are static placeholders (no DB reads).
 * Wire live data by replacing each build*() method with calls to
 * CampaignStateRepository / HexTileRepository when the overworld backend
 * is connected to the UI.
 */
public class TravelPane extends VBox {

    public TravelPane() {
        getStyleClass().add("travel-pane");

        getChildren().addAll(
                buildLocationRow(),
                buildStatusRow(),
                new Separator(),
                buildDetailsGrid(),
                new Separator(),
                buildEventSection()
        );
    }

    private HBox buildLocationRow() {
        Label icon = new Label("\uD83D\uDDFA");
        icon.getStyleClass().add("travel-location-icon");

        Label location = new Label("\u2014 Kein Ort gew\u00E4hlt \u2014");
        location.getStyleClass().add("travel-placeholder");

        HBox row = new HBox(6, icon, location);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox buildStatusRow() {
        Label statusBadge = new Label("Reisend");
        statusBadge.getStyleClass().add("travel-status-badge");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Label day = new Label("\u2014");
        day.getStyleClass().add("travel-placeholder");

        HBox row = new HBox(8, statusBadge, spacer, day);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private GridPane buildDetailsGrid() {
        GridPane grid = new GridPane();
        grid.getStyleClass().add("travel-details-grid");
        grid.setHgap(12);
        grid.setVgap(4);

        grid.add(makeDetailKey("Wetter"), 0, 0);
        grid.add(makeDetailValue("\u2601 Bew\u00F6lkt"), 1, 0);

        grid.add(makeDetailKey("Tageszeit"), 0, 1);
        grid.add(makeDetailValue("\uD83C\uDF05 Morgen"), 1, 1);

        grid.add(makeDetailKey("Tempo"), 0, 2);
        grid.add(makeDetailValue("Normal"), 1, 2);

        return grid;
    }

    private VBox buildEventSection() {
        Label eventHeader = new Label("Letztes Ereignis");
        eventHeader.getStyleClass().add("travel-section-header");

        Label eventValue = new Label("\u2014 Keine besonderen Vorkommnisse \u2014");
        eventValue.getStyleClass().add("travel-placeholder");

        Label encounterHeader = new Label("N\u00E4chste Begegnung");
        encounterHeader.getStyleClass().add("travel-section-header");

        Label encounterValue = new Label("\u2014 W\u00FCrfeln \u2014");
        encounterValue.getStyleClass().add("travel-placeholder");

        VBox section = new VBox(4, eventHeader, eventValue, encounterHeader, encounterValue);
        return section;
    }

    private Label makeDetailKey(String text) {
        Label l = new Label(text);
        l.getStyleClass().add("travel-detail-key");
        return l;
    }

    private Label makeDetailValue(String text) {
        Label l = new Label(text);
        l.getStyleClass().add("travel-detail-value");
        return l;
    }
}
