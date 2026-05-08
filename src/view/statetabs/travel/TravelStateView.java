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

    private final StyledLabel[] textLabels = new StyledLabel[6];
    private final StyledLabel[] detailKeyLabels = new StyledLabel[3];
    private final StyledLabel[] detailValueLabels = new StyledLabel[3];
    private final VBox actionItems = new VBox(6);
    private final ActionButton actionButton = new ActionButton();

    public TravelStateView() {
        getStyleClass().add("travel-pane");

        textLabels[ICON_SLOT] = new StyledLabel("travel-location-icon");
        textLabels[LOCATION_SLOT] = new StyledLabel(STYLE_TEXT_MUTED, "text-italic");
        textLabels[STATUS_SLOT] = new StyledLabel("travel-status-badge");
        textLabels[CONTEXT_SLOT] = new StyledLabel(STYLE_TEXT_MUTED, "text-italic");
        textLabels[SECTION_HEADER_SLOT] = new StyledLabel("section-header", STYLE_TEXT_MUTED);
        textLabels[SECTION_VALUE_SLOT] = new StyledLabel(STYLE_TEXT_MUTED, "text-italic");
        for (int index = 0; index < detailKeyLabels.length; index++) {
            detailKeyLabels[index] = new StyledLabel(STYLE_TEXT_MUTED);
            detailValueLabels[index] = new StyledLabel();
        }
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
        GridPane grid = new DetailsGrid();
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

    private static final class StyledLabel extends Label {

        private StyledLabel(String... styles) {
            if (styles.length > 0) {
                getStyleClass().addAll(styles);
            }
        }
    }

    private static final class ActionButton extends Button {

        private ActionButton() {
            getStyleClass().add("accent");
        }
    }

    private static final class DetailsGrid extends GridPane {

        private DetailsGrid() {
            getStyleClass().add("travel-details-grid");
        }
    }
}
