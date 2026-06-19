package src.view.statetabs.travel;

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

    private final Label iconLabel = label("travel-location-icon");
    private final Label locationLabel = label(STYLE_TEXT_MUTED, "text-italic");
    private final Label statusLabel = label("travel-status-badge");
    private final Label contextLabel = label(STYLE_TEXT_MUTED, "text-italic");
    private final Label sectionHeaderLabel = label("section-header", STYLE_TEXT_MUTED);
    private final Label sectionValueLabel = label(STYLE_TEXT_MUTED, "text-italic");
    private final Label detailKeyOneLabel = label(STYLE_TEXT_MUTED);
    private final Label detailValueOneLabel = label();
    private final Label detailKeyTwoLabel = label(STYLE_TEXT_MUTED);
    private final Label detailValueTwoLabel = label();
    private final Label detailKeyThreeLabel = label(STYLE_TEXT_MUTED);
    private final Label detailValueThreeLabel = label();

    public TravelStateView() {
        getStyleClass().add("travel-pane");

        getChildren().addAll(
                buildLocationRow(),
                buildStatusRow(),
                new Separator(),
                buildDetailsGrid(),
                new Separator(),
                buildActionSection());
    }

    public void bind(TravelStateContentModel contentModel) {
        iconLabel.textProperty().bind(contentModel.iconProperty());
        locationLabel.textProperty().bind(contentModel.locationProperty());
        statusLabel.textProperty().bind(contentModel.statusProperty());
        contextLabel.textProperty().bind(contentModel.contextProperty());
        sectionHeaderLabel.textProperty().bind(contentModel.sectionHeaderProperty());
        sectionValueLabel.textProperty().bind(contentModel.sectionValueProperty());
        bindDetail(detailKeyOneLabel, detailValueOneLabel, contentModel.weather());
        bindDetail(detailKeyTwoLabel, detailValueTwoLabel, contentModel.timeOfDay());
        bindDetail(detailKeyThreeLabel, detailValueThreeLabel, contentModel.pace());
    }

    private HBox buildLocationRow() {
        HBox row = new HBox(6, iconLabel, locationLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox buildStatusRow() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox row = new HBox(8, statusLabel, spacer, contextLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private GridPane buildDetailsGrid() {
        GridPane grid = new DetailsGrid();
        grid.add(detailKeyOneLabel, 0, 0);
        grid.add(detailValueOneLabel, 1, 0);
        grid.add(detailKeyTwoLabel, 0, 1);
        grid.add(detailValueTwoLabel, 1, 1);
        grid.add(detailKeyThreeLabel, 0, 2);
        grid.add(detailValueThreeLabel, 1, 2);
        return grid;
    }

    private VBox buildActionSection() {
        VBox actionItems = new VBox(6);
        actionItems.setFillWidth(true);
        Button actionButton = new StyledButton("accent");
        actionButton.setMaxWidth(Double.MAX_VALUE);
        actionButton.setVisible(false);
        actionButton.setManaged(false);
        return new VBox(4, sectionHeaderLabel, sectionValueLabel, actionItems, actionButton);
    }

    private static void bindDetail(
            Label keyLabel,
            Label valueLabel,
            TravelStateContentModel.Detail detail
    ) {
        keyLabel.textProperty().bind(detail.keyProperty());
        valueLabel.textProperty().bind(detail.valueProperty());
    }

    private static Label label(String... styles) {
        return new StyledLabel(styles);
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String... styles) {
            if (styles.length > 0) {
                getStyleClass().addAll(styles);
            }
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String style) {
            getStyleClass().add(style);
        }
    }

    private static final class DetailsGrid extends GridPane {

        private DetailsGrid() {
            getStyleClass().add("travel-details-grid");
        }
    }
}
