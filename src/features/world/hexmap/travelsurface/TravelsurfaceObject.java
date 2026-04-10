package features.world.hexmap.travelsurface;

import features.world.hexmap.travelsurface.input.ShowDungeonTravelInput;
import features.world.hexmap.travelsurface.input.ShowOverworldTravelInput;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.List;

/**
 * ScenePane-Inhalt fuer den Overworld-Reisemodus.
 * Platzhalter-Mockup fuer Reisekontext (Ort, Status, Wetter usw.).
 * Alle angezeigten Werte sind statische Platzhalter (keine DB-Lesezugriffe).
 * Live-Daten anbinden, indem die build*()-Methoden spaeter durch Aufrufe an
 * CampaignStateRepository / HexTileRepository ersetzt werden, sobald das
 * Overworld-Backend mit der UI verbunden ist.
 */
@SuppressWarnings("unused")
public final class TravelsurfaceObject extends VBox {

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
    private final VBox actionItems = new VBox(6);
    private final Button actionButton = new Button();

    public TravelsurfaceObject() {
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
        actionItems.setFillWidth(true);

        getChildren().addAll(
                buildLocationRow(),
                buildStatusRow(),
                new Separator(),
                buildDetailsGrid(),
                new Separator(),
                buildActionSection()
        );
        showOverworldTravel(new ShowOverworldTravelInput());
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
        VBox section = new VBox(4, sectionHeader, sectionValue, actionItems, actionButton);
        return section;
    }

    public void showOverworldTravel(ShowOverworldTravelInput input) {
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
        actionItems.getChildren().clear();
        actionButton.setVisible(false);
        actionButton.setManaged(false);
        actionButton.setOnAction(null);
    }

    public void showDungeonTravel(ShowDungeonTravelInput input) {
        ShowDungeonTravelInput resolvedPresentation = input == null
                ? new ShowDungeonTravelInput(null, null, null, null, null, null, null)
                : input;
        String resolvedArea = resolvedPresentation.areaLabel();
        iconLabel.setText("D");
        this.locationLabel.setText(resolvedPresentation.mapName());
        statusBadge.setText("Dungeon");
        contextLabel.setText(resolvedArea);
        detailKeyOne.setText("Bereich");
        detailValueOne.setText(resolvedArea);
        detailKeyTwo.setText("Feld");
        detailValueTwo.setText(resolvedPresentation.cellLabel());
        detailKeyThree.setText("Blick");
        detailValueThree.setText(resolvedPresentation.headingLabel());
        sectionHeader.setText("Interaktion");
        sectionValue.setText(resolvedPresentation.statusLabel());
        rebuildTravelActions(resolvedPresentation.actions());
        actionButton.setText("Ansicht zentrieren");
        actionButton.setVisible(resolvedPresentation.centerAction() != null);
        actionButton.setManaged(resolvedPresentation.centerAction() != null);
        actionButton.setOnAction(event -> {
            if (resolvedPresentation.centerAction() != null) {
                resolvedPresentation.centerAction().run();
            }
        });
    }

    private void rebuildTravelActions(List<ShowDungeonTravelInput.DungeonTravelActionInput> actions) {
        actionItems.getChildren().clear();
        List<ShowDungeonTravelInput.DungeonTravelActionInput> resolvedActions = actions == null ? List.of() : actions;
        if (resolvedActions.isEmpty()) {
            Label hint = new Label("Token im Dungeon auf ein begehbares Feld ziehen");
            hint.getStyleClass().add("travel-placeholder");
            hint.setWrapText(true);
            actionItems.getChildren().add(hint);
            return;
        }
        for (ShowDungeonTravelInput.DungeonTravelActionInput action : resolvedActions) {
            if (action == null) {
                continue;
            }
            Button button = new Button(action.label() == null || action.label().isBlank() ? "Tuer" : action.label());
            button.getStyleClass().add("travel-action-button");
            button.setMaxWidth(Double.MAX_VALUE);
            button.setOnAction(event -> {
                if (action.action() != null) {
                    action.action().run();
                }
            });
            actionItems.getChildren().add(button);
        }
    }
}
