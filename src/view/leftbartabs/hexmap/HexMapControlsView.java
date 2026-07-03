package src.view.leftbartabs.hexmap;

import java.util.function.Consumer;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class HexMapControlsView extends VBox {

    private Consumer<HexMapControlsViewInputEvent> eventConsumer = ignored -> { };

    public HexMapControlsView() {
        getStyleClass().addAll("surface-root", "control-toolbar");
        setFillWidth(true);
    }

    public void bind(HexMapControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        boolean[] updating = {false};
        ToggleGroup toolGroup = new ToggleGroup();
        HBox toolButtons = new HBox(6);
        ComboBox<String> terrainSelector = new ComboBox<>();
        terrainSelector.setAccessibleText("Hex-Terrain");
        terrainSelector.setMaxWidth(Double.MAX_VALUE);
        HBox terrainRow = row(label("Terrain", "text-muted"), terrainSelector);
        getChildren().setAll(toolButtons, terrainRow);
        terrainSelector.setOnAction(event -> {
            if (!updating[0]) {
                publish(
                        contentModel.currentProjection().paintTerrainToolOptionIndex(),
                        selectedTerrainOptionIndex(terrainSelector));
            }
        });
        show(contentModel.projectionProperty().get(), updating, toolGroup, toolButtons, terrainSelector);
        contentModel.projectionProperty().addListener((ignored, before, after) ->
                show(after, updating, toolGroup, toolButtons, terrainSelector));
    }

    public void onViewInputEvent(Consumer<HexMapControlsViewInputEvent> consumer) {
        eventConsumer = consumer == null ? ignored -> { } : consumer;
    }

    private void show(
            HexMapControlsContentModel.Projection projection,
            boolean[] updating,
            ToggleGroup toolGroup,
            HBox toolButtons,
            ComboBox<String> terrainSelector
    ) {
        if (projection == null) {
            return;
        }
        updating[0] = true;
        renderToolButtons(toolGroup, toolButtons, projection);
        terrainSelector.getItems().setAll(projection.terrainLabels());
        selectByIndex(terrainSelector, projection.activeTerrainOptionIndex());
        terrainSelector.setDisable(!projection.mapLoaded());
        updating[0] = false;
    }

    private void renderToolButtons(
            ToggleGroup toolGroup,
            HBox toolButtons,
            HexMapControlsContentModel.Projection projection
    ) {
        toolButtons.getChildren().clear();
        int toolIndex = 0;
        for (String toolLabel : projection.toolLabels()) {
            ToggleButton button = new ToggleButton(toolLabel);
            button.setToggleGroup(toolGroup);
            button.getStyleClass().add("tool-btn");
            button.setSelected(toolIndex == projection.activeToolOptionIndex());
            button.setDisable(!projection.mapLoaded());
            int optionIndex = toolIndex;
            button.setOnAction(event -> publish(
                    optionIndex,
                    projection.activeTerrainOptionIndex()));
            toolButtons.getChildren().add(button);
            toolIndex++;
        }
    }

    private void publish(
            int toolOptionIndex,
            int terrainOptionIndex
    ) {
        eventConsumer.accept(new HexMapControlsViewInputEvent(toolOptionIndex, terrainOptionIndex));
    }

    private static void selectByIndex(
            ComboBox<String> comboBox,
            int index
    ) {
        if (index >= 0 && index < comboBox.getItems().size()) {
            comboBox.getSelectionModel().select(index);
            return;
        }
        comboBox.getSelectionModel().selectFirst();
    }

    private static int selectedTerrainOptionIndex(ComboBox<String> terrainSelector) {
        return terrainSelector == null ? -1 : terrainSelector.getSelectionModel().getSelectedIndex();
    }

    private static HBox row(javafx.scene.Node... nodes) {
        return new HBox(8, nodes);
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }

}
