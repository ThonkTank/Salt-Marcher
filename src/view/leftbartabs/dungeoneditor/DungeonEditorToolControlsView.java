package src.view.leftbartabs.dungeoneditor;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class DungeonEditorToolControlsView {

    private static final String ROOM_FAMILY = "Raum";
    private static final String WALL_FAMILY = "Wand";
    private static final String DOOR_FAMILY = "Tür";
    private static final String CORRIDOR_FAMILY = "Korridor";
    private static final String STAIR_FAMILY = "Treppe";
    private static final String TRANSITION_FAMILY = "Übergang";
    private static final String STYLE_SELECTED = "selected";

    private final ToggleButton selectButton = createToolToggle(DungeonEditorControlsView.SELECT_TOOL);
    private final Button roomButton = createToolButton(ROOM_FAMILY);
    private final Button wallButton = createToolButton(WALL_FAMILY);
    private final Button doorButton = createToolButton(DOOR_FAMILY);
    private final Button corridorButton = createToolButton(CORRIDOR_FAMILY);
    private final Button stairButton = createToolButton(STAIR_FAMILY);
    private final Button transitionButton = createToolButton(TRANSITION_FAMILY);
    private final DungeonEditorToolPalettePopupView toolPalettePopup;
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorToolControlsView(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        this.toolPalettePopup = new DungeonEditorToolPalettePopupView(events, this);
        ToggleGroup toolGroup = new ToggleGroup();
        selectButton.setToggleGroup(toolGroup);
        selectButton.setSelected(true);
        selectButton.setOnAction(event -> events.toolSelected(DungeonEditorControlsView.SELECT_TOOL));
        panelView.describeNode(selectButton, "Auswahlwerkzeug aktivieren");
        panelView.describeNode(roomButton, "Raumwerkzeug waehlen");
        panelView.describeNode(wallButton, "Wandwerkzeug waehlen");
        panelView.describeNode(doorButton, "Türwerkzeug wählen");
        panelView.describeNode(corridorButton, "Korridorwerkzeug waehlen");
        panelView.describeNode(stairButton, "Treppenwerkzeug waehlen");
        panelView.describeNode(transitionButton, "Übergangswerkzeug wählen");

        roomButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.ROOM,
                DungeonEditorControlsView.ROOM_PAINT_TOOL));
        wallButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.WALL,
                DungeonEditorControlsView.WALL_CREATE_TOOL));
        doorButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.DOOR,
                DungeonEditorControlsView.DOOR_CREATE_TOOL));
        corridorButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.CORRIDOR,
                DungeonEditorControlsView.CORRIDOR_CREATE_TOOL));
        stairButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.STAIR,
                DungeonEditorControlsView.STAIR_CREATE_TOOL));
        transitionButton.setOnAction(event -> events.toolFamilySelected(
                DungeonEditorControlsViewInputEvent.ToolFamily.TRANSITION,
                DungeonEditorControlsView.TRANSITION_CREATE_TOOL));

        row = panelView.controlsRow(selectButton, roomButton, wallButton, doorButton,
                corridorButton, stairButton, transitionButton);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-tool-row");
    }

    HBox row() {
        return row;
    }

    void showTool(String tool) {
        String selectedTool = normalizeTool(tool);
        selectButton.setSelected(DungeonEditorControlsView.SELECT_TOOL.equals(selectedTool));
        markSelected(roomButton, matchesTool(selectedTool, DungeonEditorControlsView.ROOM_PAINT_TOOL, DungeonEditorControlsView.ROOM_DELETE_TOOL));
        markSelected(wallButton, matchesTool(selectedTool, DungeonEditorControlsView.WALL_CREATE_TOOL, DungeonEditorControlsView.WALL_DELETE_TOOL));
        markSelected(doorButton, matchesTool(selectedTool, DungeonEditorControlsView.DOOR_CREATE_TOOL, DungeonEditorControlsView.DOOR_DELETE_TOOL));
        markSelected(corridorButton, matchesTool(selectedTool, DungeonEditorControlsView.CORRIDOR_CREATE_TOOL, DungeonEditorControlsView.CORRIDOR_DELETE_TOOL));
        markSelected(stairButton, matchesTool(selectedTool, DungeonEditorControlsView.STAIR_CREATE_TOOL, DungeonEditorControlsView.STAIR_DELETE_TOOL));
        markSelected(transitionButton, matchesTool(selectedTool, DungeonEditorControlsView.TRANSITION_CREATE_TOOL, DungeonEditorControlsView.TRANSITION_DELETE_TOOL));
    }

    void showToolPalette(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        toolPalettePopup.show(toolPaletteUiState);
    }

    @Nullable Button anchorFor(DungeonEditorContributionModel.ToolFamily family) {
        if (family == null) {
            return null;
        }
        return switch (family) {
            case ROOM -> roomButton;
            case WALL -> wallButton;
            case DOOR -> doorButton;
            case CORRIDOR -> corridorButton;
            case STAIR -> stairButton;
            case TRANSITION -> transitionButton;
            case NONE -> null;
        };
    }

    private static String normalizeTool(String tool) {
        String selectedTool = tool == null || tool.isBlank() ? DungeonEditorControlsView.SELECT_TOOL : tool;
        return isKnownTool(selectedTool) ? selectedTool : DungeonEditorControlsView.SELECT_TOOL;
    }

    private static boolean isKnownTool(String tool) {
        return DungeonEditorControlsView.SELECT_TOOL.equals(tool)
                || DungeonEditorControlsView.ROOM_PAINT_TOOL.equals(tool)
                || DungeonEditorControlsView.ROOM_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.WALL_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.WALL_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.DOOR_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.DOOR_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.CORRIDOR_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.CORRIDOR_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.STAIR_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.STAIR_DELETE_TOOL.equals(tool)
                || DungeonEditorControlsView.TRANSITION_CREATE_TOOL.equals(tool)
                || DungeonEditorControlsView.TRANSITION_DELETE_TOOL.equals(tool);
    }

    private static boolean matchesTool(String selectedTool, String primaryLabel, String secondaryLabel) {
        return primaryLabel.equals(selectedTool) || secondaryLabel.equals(selectedTool);
    }

    private static void markSelected(Button button, boolean selected) {
        if (selected) {
            if (!DungeonEditorControlsFxAccess.hasStyle(button, STYLE_SELECTED)) {
                DungeonEditorControlsFxAccess.addStyle(button, STYLE_SELECTED);
            }
            return;
        }
        DungeonEditorControlsFxAccess.removeStyle(button, STYLE_SELECTED);
    }

    private static ToggleButton createToolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private static Button createToolButton(String text) {
        Button button = new Button(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
}

final class DungeonEditorToolPalettePopupView {

    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final Button primaryToolOption = createToolButton("");
    private final Button secondaryToolOption = createToolButton("");
    private final DungeonEditorControlsGate hiddenGate = new DungeonEditorControlsGate();
    private final DungeonEditorControlsEvents events;
    private final DungeonEditorToolControlsView toolControls;
    private final AnchoredPopupView popup;
    private @Nullable Button anchor;

    DungeonEditorToolPalettePopupView(DungeonEditorControlsEvents events, DungeonEditorToolControlsView toolControls) {
        this.events = events;
        this.toolControls = toolControls;
        HBox panel = new HBox(8, primaryToolOption, secondaryToolOption);
        panel.setPadding(new Insets(10));
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form");
        popup = new AnchoredPopupView(panel, () -> anchor, () -> primaryToolOption);
        popup.bind(popupContentModel);
        popup.onViewInputEvent(event -> {
            if (event.interaction().isHidden()) {
                handleHidden();
            }
        });
    }

    void show(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        DungeonEditorContributionModel.ToolPaletteUiState resolvedState = toolPaletteUiState == null
                ? DungeonEditorContributionModel.ToolPaletteUiState.closed()
                : toolPaletteUiState;
        primaryToolOption.setText(resolvedState.primaryToolLabel());
        secondaryToolOption.setText(resolvedState.secondaryToolLabel());
        primaryToolOption.setOnAction(event -> events.toolSelected(resolvedState.primaryToolLabel()));
        secondaryToolOption.setOnAction(event -> events.toolSelected(resolvedState.secondaryToolLabel()));
        if (!resolvedState.visible()) {
            hidePopup();
            return;
        }
        anchor = toolControls.anchorFor(resolvedState.family());
        if (anchor == null) {
            hidePopup();
            return;
        }
        if (popupContentModel.isOpen()) {
            hidePopup();
        }
        popupContentModel.showBelow(2.0, true);
    }

    private void handleHidden() {
        if (!hiddenGate.enabled()) {
            events.toolDismissed();
        }
    }

    private void hidePopup() {
        if (popupContentModel.isOpen()) {
            hiddenGate.runSuppressed(popupContentModel::hide);
        }
    }

    private static Button createToolButton(String text) {
        Button button = new Button(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }
}
