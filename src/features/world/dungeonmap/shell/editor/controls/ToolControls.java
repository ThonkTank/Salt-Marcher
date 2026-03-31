package features.world.dungeonmap.shell.editor.controls;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.EnumMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;

public final class ToolControls {

    private final ToggleGroup toolGroup = new ToggleGroup();
    private final ToggleButton selectButton = createToggleButton(DungeonEditorTool.SELECT.label());
    private final Map<ToolFamily, Button> familyButtons = new EnumMap<>(ToolFamily.class);
    private final Button roomButton = createButton("Raum");
    private final Button wallButton = createButton("Wand");
    private final Button doorButton = createButton("Tür");
    private final Button transitionButton = createButton("Übergang");
    private final GuardState sync = new GuardState();
    private final ToolFamilyDropdownController dropdownController;
    private final VBox content;
    private Consumer<DungeonEditorTool> onToolChanged = tool -> { };
    private DungeonEditorTool displayedTool = DungeonEditorTool.SELECT;

    public ToolControls(ToolFamilyDropdownController dropdownController, Function<String, Label> sectionLabelFactory) {
        this.dropdownController = dropdownController;
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);

        familyButtons.put(ToolFamily.ROOM, roomButton);
        familyButtons.put(ToolFamily.WALL, wallButton);
        familyButtons.put(ToolFamily.DOOR, doorButton);
        familyButtons.put(ToolFamily.TRANSITION, transitionButton);

        toolGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (sync.isActive()) {
                return;
            }
            if (newToggle == null) {
                sync.run(() -> restoreSelection(oldToggle, selectButton));
                return;
            }
            if (newToggle == selectButton) {
                selectToolFromUser(DungeonEditorTool.SELECT);
            }
        });

        for (ToolFamily family : ToolFamily.values()) {
            Button familyButton = familyButtons.get(family);
            this.dropdownController.bindAnchor(familyButton);
            familyButton.setOnAction(event -> activateFamily(family));
        }

        HBox row = new HBox(6, selectButton, roomButton, wallButton, doorButton, transitionButton);
        row.setAlignment(Pos.CENTER_LEFT);
        content = new VBox(6, sectionLabelFactory.apply("Werkzeug"), row);
        content.getStyleClass().add("editor-toolbar-group");
        showDisplayedTool(DungeonEditorTool.SELECT);
    }

    public VBox content() {
        return content;
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        this.onToolChanged = onToolChanged == null ? tool -> { } : onToolChanged;
    }

    public void showDisplayedTool(DungeonEditorTool tool) {
        DungeonEditorTool nextTool = normalizeTool(tool);
        displayedTool = nextTool;
        sync.run(() -> {
            selectButton.setSelected(nextTool == DungeonEditorTool.SELECT);
            if (nextTool != DungeonEditorTool.SELECT) {
                toolGroup.selectToggle(null);
            }
        });
        for (var entry : familyButtons.entrySet()) {
            setSelected(entry.getValue(), entry.getKey() == ToolFamily.forTool(nextTool));
        }
    }

    private void activateFamily(ToolFamily family) {
        Button anchor = familyButtons.get(family);
        DungeonEditorTool primaryTool = family.primaryTool();
        if (displayedTool != primaryTool) {
            selectToolFromUser(primaryTool);
        }
        dropdownController.showFamilyOptions(anchor, family, primaryTool, this::selectToolFromUser);
    }

    private void selectToolFromUser(DungeonEditorTool tool) {
        DungeonEditorTool nextTool = normalizeTool(tool);
        if (displayedTool == nextTool) {
            showDisplayedTool(nextTool);
            return;
        }
        showDisplayedTool(nextTool);
        onToolChanged.accept(nextTool);
    }

    private static ToggleButton createToggleButton(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static Button createButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static void setSelected(Button button, boolean selected) {
        if (selected) {
            if (!button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
        } else {
            button.getStyleClass().remove("selected");
        }
    }

    private static void restoreSelection(Toggle previousToggle, Toggle fallbackToggle) {
        if (previousToggle != null) {
            previousToggle.setSelected(true);
        } else if (fallbackToggle != null) {
            fallbackToggle.setSelected(true);
        }
    }

    private static DungeonEditorTool normalizeTool(DungeonEditorTool tool) {
        return tool == null ? DungeonEditorTool.SELECT : tool;
    }
}
