package features.world.dungeonmap.ui.editor.sidebar;

import features.world.dungeonmap.model.BrushShape;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

final class BrushSettingsCard {

    private final Spinner<Integer> brushSizeSpinner = new Spinner<>(new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 5, 1));
    private final ToggleGroup shapeGroup = new ToggleGroup();
    private final ToggleButton squareShapeButton = new ToggleButton("\u25a1 Viereck");
    private final ToggleButton circleShapeButton = new ToggleButton("\u25cb Kreis");
    private final ToggleButton diamondShapeButton = new ToggleButton("\u25c7 Raute");
    private final VBox root;

    public BrushSettingsCard() {
        squareShapeButton.setToggleGroup(shapeGroup);
        squareShapeButton.setUserData(BrushShape.SQUARE);
        squareShapeButton.setSelected(true);
        circleShapeButton.setToggleGroup(shapeGroup);
        circleShapeButton.setUserData(BrushShape.CIRCLE);
        diamondShapeButton.setToggleGroup(shapeGroup);
        diamondShapeButton.setUserData(BrushShape.DIAMOND);
        shapeGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (newToggle == null && oldToggle != null) {
                oldToggle.setSelected(true);
            }
        });

        brushSizeSpinner.setPrefWidth(70);
        brushSizeSpinner.setEditable(false);

        Label brushLabel = new Label("Pinselgröße");
        brushLabel.getStyleClass().add("text-muted");
        HBox brushRow = new HBox(6, brushLabel, brushSizeSpinner);
        brushRow.setAlignment(Pos.CENTER_LEFT);

        HBox shapeRow = new HBox(4, squareShapeButton, circleShapeButton, diamondShapeButton);
        root = DungeonSidebarCards.createCard("Pinsel", new VBox(6, brushRow, shapeRow));
    }

    public Node root() {
        return root;
    }

    public int brushSize() {
        return brushSizeSpinner.getValue();
    }

    public BrushShape brushShape() {
        Toggle selected = shapeGroup.getSelectedToggle();
        return selected != null ? (BrushShape) selected.getUserData() : BrushShape.SQUARE;
    }

    public void setBrushPaintModeActive(boolean active) {
        brushSizeSpinner.setDisable(!active);
    }
}
