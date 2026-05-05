package src.view.statetabs.travel;

import javafx.beans.property.StringProperty;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public final class TravelStateView extends VBox {

    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final int ICON_SLOT = 0;
    private static final int LOCATION_SLOT = 1;
    private static final int STATUS_SLOT = 2;
    private static final int CONTEXT_SLOT = 3;
    private static final int SECTION_HEADER_SLOT = 4;
    private static final int SECTION_VALUE_SLOT = 5;

    private final Label[] textLabels = new Label[6];
    private final Label[] detailKeyLabels = new Label[3];
    private final Label[] detailValueLabels = new Label[3];
    private final VBox actionItems = new VBox(6);
    private final Button actionButton = new Button();

    public TravelStateView() {
        getStyleClass().add("travel-pane");

        for (int index = 0; index < textLabels.length; index++) {
            textLabels[index] = new Label();
        }
        for (int index = 0; index < detailKeyLabels.length; index++) {
            detailKeyLabels[index] = new Label();
            detailValueLabels[index] = new Label();
        }

        textLabels[ICON_SLOT].getStyleClass().add("travel-location-icon");
        textLabels[LOCATION_SLOT].getStyleClass().addAll(STYLE_TEXT_MUTED, "text-italic");
        textLabels[STATUS_SLOT].getStyleClass().add("travel-status-badge");
        textLabels[CONTEXT_SLOT].getStyleClass().addAll(STYLE_TEXT_MUTED, "text-italic");
        detailKeyLabels[0].getStyleClass().add(STYLE_TEXT_MUTED);
        detailKeyLabels[1].getStyleClass().add(STYLE_TEXT_MUTED);
        detailKeyLabels[2].getStyleClass().add(STYLE_TEXT_MUTED);
        textLabels[SECTION_HEADER_SLOT].getStyleClass().addAll("section-header", STYLE_TEXT_MUTED);
        textLabels[SECTION_VALUE_SLOT].getStyleClass().addAll(STYLE_TEXT_MUTED, "text-italic");
        actionButton.getStyleClass().add("accent");
        actionButton.setMaxWidth(Double.MAX_VALUE);
        actionButton.setVisible(false);
        actionButton.setManaged(false);
        actionItems.setFillWidth(true);

        getChildren().addAll(
                buildLocationRow(),
                buildStatusRow(),
                new Separator(),
                buildDetailsGrid(),
                new Separator(),
                buildActionSection());
    }

    StringProperty textProperty(int index) {
        return textLabels[index].textProperty();
    }

    StringProperty detailKeyProperty(int index) {
        return detailKeyLabels[index].textProperty();
    }

    StringProperty detailValueProperty(int index) {
        return detailValueLabels[index].textProperty();
    }

    private HBox buildLocationRow() {
        HBox row = new HBox(6, textLabels[ICON_SLOT], textLabels[LOCATION_SLOT]);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox buildStatusRow() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(8, textLabels[STATUS_SLOT], spacer, textLabels[CONTEXT_SLOT]);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private GridPane buildDetailsGrid() {
        GridPane grid = new GridPane();
        grid.getStyleClass().add("travel-details-grid");
        grid.setHgap(12);
        grid.setVgap(4);
        int rowIndex = 0;
        for (int index = 0; index < detailKeyLabels.length; index++) {
            grid.add(detailKeyLabels[index], 0, rowIndex);
            grid.add(detailValueLabels[index], 1, rowIndex);
            rowIndex++;
        }
        return grid;
    }

    private VBox buildActionSection() {
        return new VBox(4, textLabels[SECTION_HEADER_SLOT], textLabels[SECTION_VALUE_SLOT], actionItems, actionButton);
    }
}
