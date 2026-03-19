package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.canvas.base.DungeonViewMode;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.Region;

import java.util.function.Consumer;

public final class ViewModeControls {

    private final ToggleGroup viewGroup = new ToggleGroup();
    private final ToggleButton gridButton = createToggleButton(DungeonViewMode.GRID.label());
    private final ToggleButton graphButton = createToggleButton(DungeonViewMode.GRAPH.label());
    private final GuardState sync = new GuardState();
    private Consumer<DungeonViewMode> onViewModeChanged;

    public ViewModeControls() {
        gridButton.setToggleGroup(viewGroup);
        graphButton.setToggleGroup(viewGroup);
        gridButton.setSelected(true);
        viewGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (sync.isActive()) {
                return;
            }
            if (newToggle != null) {
                if (onViewModeChanged != null) {
                    onViewModeChanged.accept(newToggle == graphButton ? DungeonViewMode.GRAPH : DungeonViewMode.GRID);
                }
                return;
            }
            sync.run(() -> restoreSelection(oldToggle, gridButton));
        });
    }

    public void setOnViewModeChanged(Consumer<DungeonViewMode> onViewModeChanged) {
        this.onViewModeChanged = onViewModeChanged;
    }

    public void selectViewMode(DungeonViewMode viewMode) {
        sync.run(() -> {
            if (viewMode == DungeonViewMode.GRAPH) {
                graphButton.setSelected(true);
            } else {
                gridButton.setSelected(true);
            }
        });
    }

    ToggleButton gridButton() {
        return gridButton;
    }

    ToggleButton graphButton() {
        return graphButton;
    }

    private static ToggleButton createToggleButton(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static void restoreSelection(Toggle previousToggle, Toggle fallbackToggle) {
        if (previousToggle != null) {
            previousToggle.setSelected(true);
        } else if (fallbackToggle != null) {
            fallbackToggle.setSelected(true);
        }
    }
}
