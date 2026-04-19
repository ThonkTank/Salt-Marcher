package src.view.dungeonmap.View;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import src.view.dungeonmap.api.DungeonEditorTool;
import src.view.dungeonmap.api.DungeonMapSurfaceViewModel;
import src.view.dungeonmap.api.DungeonViewportViewModel;

public final class DungeonEditorControls extends VBox {
    private final DungeonControlsPanel controlsPanel;
    private final ToggleGroup toolGroup = new ToggleGroup();
    private final Map<DungeonEditorTool, ToggleButton> toolButtons = new EnumMap<>(DungeonEditorTool.class);
    private Consumer<DungeonEditorTool> onToolChanged = ignored -> { };
    private boolean syncingToolSelection;

    public DungeonEditorControls(
            DungeonMapSurfaceViewModel controller,
            Supplier<DungeonViewportViewModel> viewportSupplier
    ) {
        Objects.requireNonNull(controller, "controller");
        this.controlsPanel = new DungeonControlsPanel(
                DungeonControlsPanel.Mode.EDITOR,
                controller,
                Objects.requireNonNull(viewportSupplier, "viewportSupplier"),
                null);
        Button newMapButton = DungeonControlsPanel.actionButton("Neuen Dungeon");
        newMapButton.setOnAction(event -> controller.createMap(controller.defaultMapName(), viewportSupplier.get()));
        Button graphButton = DungeonControlsPanel.actionButton("Graph");
        graphButton.setDisable(true);
        controlsPanel.setMapRowActions(newMapButton, graphButton);
        controlsPanel.setModeControls(buildToolGroup());
        getChildren().setAll(controlsPanel);
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        this.onToolChanged = onToolChanged == null ? ignored -> { } : onToolChanged;
    }

    public void showActiveTool(DungeonEditorTool tool) {
        withToolSelectionSync(() -> {
            ToggleButton button = toolButtons.get(tool == null ? DungeonEditorTool.defaultTool() : tool);
            if (button != null) {
                toolGroup.selectToggle(button);
            }
        });
    }

    public void refresh() {
        controlsPanel.refresh();
    }

    private VBox buildToolGroup() {
        HBox toolsRow = new HBox(6);
        toolsRow.setAlignment(Pos.CENTER_LEFT);
        for (DungeonEditorTool tool : DungeonEditorTool.values()) {
            toolsRow.getChildren().add(buildToolButton(tool));
        }
        VBox toolGroupBox = new VBox(6, MapWorkspaceSupport.sectionLabel("Werkzeug"), toolsRow);
        toolGroupBox.getStyleClass().add("control-group");
        return toolGroupBox;
    }

    private ToggleButton buildToolButton(DungeonEditorTool tool) {
        ToggleButton button = new ToggleButton(tool.label());
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(USE_PREF_SIZE);
        button.setToggleGroup(toolGroup);
        button.setOnAction(event -> {
            if (!syncingToolSelection) {
                onToolChanged.accept(tool);
            }
        });
        toolButtons.put(tool, button);
        return button;
    }

    @SuppressWarnings("PMD.UnusedAssignment")
    private void withToolSelectionSync(Runnable action) {
        syncingToolSelection = true;
        try {
            action.run();
        } finally {
            syncingToolSelection = false;
        }
    }
}
