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

    public TravelStateView() {
        getStyleClass().add("travel-pane");

        iconLabel.getStyleClass().add("travel-location-icon");
        locationLabel.getStyleClass().addAll("text-muted", "text-italic");
        statusBadge.getStyleClass().add("travel-status-badge");
        contextLabel.getStyleClass().addAll("text-muted", "text-italic");
        detailKeyOne.getStyleClass().add("text-muted");
        detailKeyTwo.getStyleClass().add("text-muted");
        detailKeyThree.getStyleClass().add("text-muted");
        sectionHeader.getStyleClass().addAll("section-header", "text-muted");
        sectionValue.getStyleClass().addAll("text-muted", "text-italic");
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

    StringProperty iconTextProperty() {
        return iconLabel.textProperty();
    }

    StringProperty locationTextProperty() {
        return locationLabel.textProperty();
    }

    StringProperty statusTextProperty() {
        return statusBadge.textProperty();
    }

    StringProperty contextTextProperty() {
        return contextLabel.textProperty();
    }

    StringProperty detailKeyOneTextProperty() {
        return detailKeyOne.textProperty();
    }

    StringProperty detailValueOneTextProperty() {
        return detailValueOne.textProperty();
    }

    StringProperty detailKeyTwoTextProperty() {
        return detailKeyTwo.textProperty();
    }

    StringProperty detailValueTwoTextProperty() {
        return detailValueTwo.textProperty();
    }

    StringProperty detailKeyThreeTextProperty() {
        return detailKeyThree.textProperty();
    }

    StringProperty detailValueThreeTextProperty() {
        return detailValueThree.textProperty();
    }

    StringProperty sectionHeaderTextProperty() {
        return sectionHeader.textProperty();
    }

    StringProperty sectionValueTextProperty() {
        return sectionValue.textProperty();
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
        return new VBox(4, sectionHeader, sectionValue, actionItems, actionButton);
    }
}
