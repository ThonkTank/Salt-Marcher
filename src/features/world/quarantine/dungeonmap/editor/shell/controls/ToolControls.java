package features.world.quarantine.dungeonmap.editor.shell.controls;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
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
import java.util.function.UnaryOperator;

public final class ToolControls {

    private final ToggleGroup toolGroup = new ToggleGroup();
    private final ToggleButton selectButton = createToggleButton(DungeonEditorTool.SELECT.label());
    private final Map<ToolFamily, Button> familyButtons = new EnumMap<>(ToolFamily.class);
    private final Button roomButton = createToolButton("Raum");
    private final Button wallButton = createToolButton("Wand");
    private final Button doorButton = createToolButton("Tür");
    private final Button corridorButton = createToolButton("Korridor");
    private final GuardState toolSync = new GuardState();
    private final ToolFamilyDropdownController dropdownController;
    private final VBox content;
    private Consumer<DungeonEditorTool> onToolChanged;
    private UnaryOperator<DungeonEditorTool> preferredToolResolver = ToolControls::normalizeTool;
    private DungeonEditorTool displayedTool = DungeonEditorTool.SELECT;

    public ToolControls(ToolFamilyDropdownController dropdownController, Function<String, Label> sectionLabelFactory) {
        this.dropdownController = dropdownController;
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);

        familyButtons.put(ToolFamily.ROOM, roomButton);
        familyButtons.put(ToolFamily.WALL, wallButton);
        familyButtons.put(ToolFamily.DOOR, doorButton);
        familyButtons.put(ToolFamily.CORRIDOR, corridorButton);

        toolGroup.selectedToggleProperty().addListener((obs, oldToggle, newToggle) -> {
            if (toolSync.isActive()) {
                return;
            }
            if (newToggle == null) {
                toolSync.run(() -> restoreSelection(oldToggle, selectButton));
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

        HBox toolRow = new HBox(6, selectButton, roomButton, wallButton, doorButton, corridorButton);
        toolRow.setAlignment(Pos.CENTER_LEFT);
        content = new VBox(6, sectionLabelFactory.apply("Werkzeug"), toolRow);
        content.getStyleClass().add("editor-toolbar-group");
        render();
    }

    public VBox content() {
        return content;
    }

    public void setOnToolChanged(Consumer<DungeonEditorTool> onToolChanged) {
        this.onToolChanged = onToolChanged;
    }

    public void setPreferredToolResolver(UnaryOperator<DungeonEditorTool> preferredToolResolver) {
        this.preferredToolResolver = preferredToolResolver == null ? ToolControls::normalizeTool : preferredToolResolver;
    }

    public void showDisplayedTool(DungeonEditorTool tool) {
        DungeonEditorTool normalizedTool = normalizeTool(tool);
        if (displayedTool == normalizedTool) {
            return;
        }
        displayedTool = normalizedTool;
        render();
    }

    private void activateFamily(ToolFamily family) {
        Button anchor = familyButtons.get(family);
        DungeonEditorTool preferredTool = resolvePreferredTool(family.primaryTool());
        if (displayedTool != preferredTool) {
            selectToolFromUser(preferredTool);
        }
        dropdownController.showFamilyOptions(anchor, family, preferredTool, this::selectToolFromUser);
    }

    private void selectToolFromUser(DungeonEditorTool tool) {
        DungeonEditorTool normalizedTool = normalizeTool(tool);
        if (displayedTool == normalizedTool) {
            return;
        }
        displayedTool = normalizedTool;
        render();
        if (onToolChanged != null) {
            onToolChanged.accept(normalizedTool);
        }
    }

    private DungeonEditorTool resolvePreferredTool(DungeonEditorTool tool) {
        DungeonEditorTool preferredTool = preferredToolResolver.apply(tool);
        return preferredTool == null ? tool : preferredTool;
    }

    private void render() {
        toolSync.run(() -> {
            selectButton.setSelected(displayedTool == DungeonEditorTool.SELECT);
            if (displayedTool != DungeonEditorTool.SELECT) {
                toolGroup.selectToggle(null);
            }
            refreshFamilyStyles(displayedTool);
        });
    }

    private void refreshFamilyStyles(DungeonEditorTool activeTool) {
        ToolFamily selectedFamily = ToolFamily.forTool(activeTool);
        for (var entry : familyButtons.entrySet()) {
            setSelected(entry.getValue(), entry.getKey() == selectedFamily);
        }
    }

    private static ToggleButton createToggleButton(String text) {
        ToggleButton button = new ToggleButton(text);
        button.getStyleClass().add("tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static Button createToolButton(String text) {
        Button button = new Button(text);
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

    private static DungeonEditorTool normalizeTool(DungeonEditorTool tool) {
        return tool == null ? DungeonEditorTool.SELECT : tool;
    }

    private static void setSelected(Button button, boolean selected) {
        if (selected) {
            if (!button.getStyleClass().contains("selected")) {
                button.getStyleClass().add("selected");
            }
            return;
        }
        button.getStyleClass().remove("selected");
    }
}
