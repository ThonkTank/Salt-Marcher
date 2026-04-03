package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.state.DungeonViewMode;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.Region;

import java.util.function.Consumer;

/**
 * View controls should expose only modes that are fully supported by the active model semantics.
 */
public final class ViewModeControls {

    private final ToggleGroup viewGroup = new ToggleGroup();
    private final ToggleButton gridButton = createToggleButton(DungeonViewMode.GRID.label());
    private final GuardState sync = new GuardState();
    private Consumer<DungeonViewMode> onViewModeChanged;

    public ViewModeControls() {
        gridButton.setToggleGroup(viewGroup);
        gridButton.setSelected(true);
        viewGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (sync.isActive()) {
                return;
            }
            if (newToggle != null) {
                if (onViewModeChanged != null) {
                    onViewModeChanged.accept(DungeonViewMode.GRID);
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
        sync.run(() -> gridButton.setSelected(true));
    }

    ToggleButton gridButton() {
        return gridButton;
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
