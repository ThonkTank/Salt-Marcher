package features.world.hexmap.ui.travel;

import features.world.api.WorldTravelSurface;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

/**
 * ScenePane-Inhalt fuer den Overworld-Reisemodus.
 * Platzhalter-Mockup fuer Reisekontext (Ort, Status, Wetter usw.).
 * Alle angezeigten Werte sind statische Platzhalter (keine DB-Lesezugriffe).
 * Live-Daten anbinden, indem die build*()-Methoden spaeter durch Aufrufe an
 * CampaignStateRepository / HexTileRepository ersetzt werden, sobald das
 * Overworld-Backend mit der UI verbunden ist.
 */
public class TravelPane extends VBox implements WorldTravelSurface {

    private final Label iconLabel = new Label();
    private final Label locationLabel = new Label();
    private final Label statusBadge = new Label();
    private final Label contextLabel = new Label();
    private final Label detailKeyOne = new Label();
    private final Label detailValueOne = new Label();
    private final Label detailKeyTwo = new Label();
    private final Label detailValueTwo = new Label();
    private final Label detailKeyThree = new Label();
    private final Label detailValueThree = new Label();
    private final Label sectionHeader = new Label();
    private final Label sectionValue = new Label();
    private final Button actionButton = new Button();

    public TravelPane() {
        getStyleClass().add("travel-pane");

        iconLabel.getStyleClass().add("travel-location-icon");
        locationLabel.getStyleClass().add("travel-placeholder");
        statusBadge.getStyleClass().add("travel-status-badge");
        contextLabel.getStyleClass().add("travel-placeholder");
        detailKeyOne.getStyleClass().add("travel-detail-key");
        detailValueOne.getStyleClass().add("travel-detail-value");
        detailKeyTwo.getStyleClass().add("travel-detail-key");
        detailValueTwo.getStyleClass().add("travel-detail-value");
        detailKeyThree.getStyleClass().add("travel-detail-key");
        detailValueThree.getStyleClass().add("travel-detail-value");
        sectionHeader.getStyleClass().add("travel-section-header");
        sectionValue.getStyleClass().add("travel-placeholder");
        actionButton.getStyleClass().add("travel-action-button");
        actionButton.setMaxWidth(Double.MAX_VALUE);

        getChildren().addAll(
                buildLocationRow(),
                buildStatusRow(),
                new Separator(),
                buildDetailsGrid(),
                new Separator(),
                buildActionSection()
        );
        showOverworldTravel();
    }

    private HBox buildLocationRow() {
        HBox row = new HBox(6, iconLabel, locationLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox buildStatusRow() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(8, statusBadge, spacer, contextLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private GridPane buildDetailsGrid() {
        GridPane grid = new GridPane();
        grid.getStyleClass().add("travel-details-grid");
        grid.setHgap(12);
        grid.setVgap(4);

        grid.add(detailKeyOne, 0, 0);
        grid.add(detailValueOne, 1, 0);
        grid.add(detailKeyTwo, 0, 1);
        grid.add(detailValueTwo, 1, 1);
        grid.add(detailKeyThree, 0, 2);
        grid.add(detailValueThree, 1, 2);

        return grid;
    }

    private VBox buildActionSection() {
        VBox section = new VBox(4, sectionHeader, sectionValue, actionButton);
        return section;
    }

    @Override
    public void showOverworldTravel() {
        iconLabel.setText("W");
        locationLabel.setText("\u2014 Kein Ort gew\u00E4hlt \u2014");
        statusBadge.setText("Reisend");
        contextLabel.setText("\u2014");
        detailKeyOne.setText("Wetter");
        detailValueOne.setText("Bew\u00F6lkt");
        detailKeyTwo.setText("Tageszeit");
        detailValueTwo.setText("Morgen");
        detailKeyThree.setText("Tempo");
        detailValueThree.setText("Normal");
        sectionHeader.setText("Interaktion");
        sectionValue.setText("Gruppenmarker auf der Karte ziehen");
        actionButton.setVisible(false);
        actionButton.setManaged(false);
        actionButton.setOnAction(null);
    }

    @Override
    public TravelPane sceneContent() {
        return this;
    }

    @Override
    public void showDungeonTravel(
            String mapName,
            String areaLabel,
            String tileLabel,
            String statusLabel,
            Runnable centerAction
    ) {
        String resolvedArea = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel;
        iconLabel.setText("D");
        this.locationLabel.setText(mapName == null || mapName.isBlank() ? "Dungeon" : mapName);
        statusBadge.setText("Dungeon");
        contextLabel.setText(resolvedArea);
        detailKeyOne.setText("Bereich");
        detailValueOne.setText(resolvedArea);
        detailKeyTwo.setText("Feld");
        detailValueTwo.setText(tileLabel == null || tileLabel.isBlank() ? "\u2014" : tileLabel);
        detailKeyThree.setText("Status");
        detailValueThree.setText(statusLabel == null || statusLabel.isBlank() ? "\u2014" : statusLabel);
        sectionHeader.setText("Interaktion");
        sectionValue.setText("Token im Dungeon auf ein begehbares Feld ziehen");
        actionButton.setText("Ansicht zentrieren");
        actionButton.setVisible(centerAction != null);
        actionButton.setManaged(centerAction != null);
        actionButton.setOnAction(event -> {
            if (centerAction != null) {
                centerAction.run();
            }
        });
    }
}
