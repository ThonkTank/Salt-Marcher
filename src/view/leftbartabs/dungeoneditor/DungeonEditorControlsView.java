package src.view.leftbartabs.dungeoneditor;

import java.util.Iterator;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Pos;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.OverrunStyle;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;

public final class DungeonEditorControlsView extends VBox {

    private static final String SELECTED_STYLE_CLASS = "selected";
    private static final String DUNGEON_OVERLAY_LEVELS_FIELD_STYLE = "dungeon-overlay-levels-field";

    private Consumer<DungeonEditorControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public DungeonEditorControlsView() {
        styled(this, "surface-root", "dungeon-control-panel", "control-toolbar");
        setFillWidth(true);
        addEventHandler(KeyEvent.KEY_PRESSED, this::handleControlsShortcut);
    }

    public void onViewInputEvent(Consumer<DungeonEditorControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(DungeonEditorControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        boolean[] rendering = {false};
        DungeonEditorControlsContentModel.ToolControls toolControls = contentModel.toolControls();
        ProjectionSection projectionSection = new ProjectionSection(contentModel, toolControls, rendering);
        ToolSection toolSection = new ToolSection(toolControls);

        replaceChildren(
                this,
                projectionSection,
                projectionSection.overlayRow(),
                toolSection);

        projectionSection.bind(contentModel);
        toolSection.bind(contentModel, toolControls);
    }

    private final class ProjectionSection extends HBox {

        private final boolean[] rendering;
        private final Label levelLabel = mutedLabel("Ebene z=0");
        private final Button previousLevelButton = actionButton("-");
        private final Button nextLevelButton = actionButton("+");
        private final ToggleButton gridButton;
        private final ToggleButton graphButton;
        private final Button overlayTrigger = actionButton("Overlay: Aus");
        private final ComboBox<Object> overlayModeSelector = new ComboBox<>();
        private final Spinner<Integer> overlayRangeSpinner = new Spinner<>(1, 6, 2);
        private final Slider overlayOpacitySlider = new Slider(10, 90, 35);
        private final Label overlayOpacityLabel = mutedLabel("35%");
        private final TextField selectedLevelsField = new TextField();
        private final ContextMenu overlayMenu = new ContextMenu();
        private final Spinner<Integer> popupOverlayRangeSpinner = new Spinner<>(1, 6, 2);
        private final Slider popupOverlayOpacitySlider = new Slider(10, 90, 35);
        private final Label popupOverlayOpacityLabel = mutedLabel("35%");
        private final TextField popupSelectedLevelsField = new TextField();
        private final HBox overlayRangeRow = row(new Label("Umfang"), overlayRangeSpinner);
        private final HBox selectedLevelsRow = row(new Label("Ebenen"), selectedLevelsField);
        private final HBox popupOverlayModeRow = row();
        private final HBox popupOverlayRangeRow = row(new Label("Umfang"), popupOverlayRangeSpinner);
        private final HBox popupSelectedLevelsRow = row(new Label("Ebenen"), popupSelectedLevelsField);
        private final HBox overlayRow;

        private ProjectionSection(
                DungeonEditorControlsContentModel contentModel,
                DungeonEditorControlsContentModel.ToolControls toolControls,
                boolean[] rendering
        ) {
            this.rendering = rendering;
            gridButton = toolToggle(toolControls.gridView());
            graphButton = toolToggle(toolControls.graphView());
            styled(this, controlRowStyle(), "dungeon-control-projection-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
            replaceChildren(
                    this,
                    styled(group(levelLabel, previousLevelButton, nextLevelButton), "dungeon-stepper-group"),
                    styled(group(gridButton, graphButton), "dungeon-segment-group"));
            overlayRow = styled(
                    row(
                            overlayTrigger,
                            overlayModeSelector,
                            row(new Label("Staerke"), overlayOpacitySlider, overlayOpacityLabel),
                            overlayRangeRow,
                            selectedLevelsRow),
                    "dungeon-overlay-content");
            configureProjectionControls(toolControls);
            configureOverlayControls(contentModel);
        }

        private HBox overlayRow() {
            return overlayRow;
        }

        private void bind(DungeonEditorControlsContentModel contentModel) {
            contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
            show(contentModel.projectionProperty().get());
        }

        private void configureProjectionControls(DungeonEditorControlsContentModel.ToolControls toolControls) {
            ToggleGroup viewModeGroup = new ToggleGroup();
            previousLevelButton.setAccessibleText("Vorherige Dungeon-Ebene anzeigen");
            nextLevelButton.setAccessibleText("Nächste Dungeon-Ebene anzeigen");
            previousLevelButton.setOnAction(event -> emitProjectionShift(-1));
            nextLevelButton.setOnAction(event -> emitProjectionShift(1));
            gridButton.setToggleGroup(viewModeGroup);
            graphButton.setToggleGroup(viewModeGroup);
            gridButton.setSelected(true);
            viewModeGroup.selectedToggleProperty().addListener((ignored, oldToggle, newToggle) ->
                    handleViewModeChanged(rendering, oldToggle, newToggle, graphButton, gridButton, toolControls));
        }

        private void show(DungeonEditorControlsContentModel.ProjectionState projection) {
            DungeonEditorControlsContentModel.ProjectionState safeProjection = projection;
            levelLabel.setText("Ebene z=" + safeProjection.activeLevel());
            previousLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
            nextLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
            rendering[0] = true;
            graphButton.setSelected(safeProjection.graphViewSelected());
            gridButton.setSelected(!safeProjection.graphViewSelected());
            showOverlay(safeProjection.overlayPanelState());
            rendering[0] = false;
        }

        private void configureOverlayControls(DungeonEditorControlsContentModel contentModel) {
            replaceComboItems(overlayModeSelector, contentModel.overlayModeOptions());
            replacePopupOverlayModeButtons(contentModel.overlayModeOptions());
            overlayRangeSpinner.setEditable(true);
            popupOverlayRangeSpinner.setEditable(true);
            overlayOpacitySlider.setShowTickMarks(false);
            overlayOpacitySlider.setShowTickLabels(false);
            popupOverlayOpacitySlider.setShowTickMarks(false);
            popupOverlayOpacitySlider.setShowTickLabels(false);
            selectedLevelsField.setPromptText("-1, 1, 3");
            popupSelectedLevelsField.setPromptText("-1, 1, 3");
            selectedLevelsField.getStyleClass().add(DUNGEON_OVERLAY_LEVELS_FIELD_STYLE);
            popupSelectedLevelsField.getStyleClass().add(DUNGEON_OVERLAY_LEVELS_FIELD_STYLE);
            overlayTrigger.setAccessibleText("Overlay-Einstellungen öffnen");
            popupOverlayModeRow.setAccessibleText("Overlay-Popup-Modus waehlen");
            popupOverlayRangeSpinner.setAccessibleText("Overlay-Popup-Reichweite einstellen");
            popupOverlayOpacitySlider.setAccessibleText("Overlay-Popup-Deckkraft einstellen");
            popupSelectedLevelsField.setAccessibleText("Overlay-Popup-Ebenen eingeben");
            overlayTrigger.setOnAction(event -> showOverlayPopup());
            ChangeListener<Object> overlayListener = (ignored, before, after) -> emitCurrentOverlay();
            overlayModeSelector.valueProperty().addListener(overlayListener);
            overlayRangeSpinner.valueProperty().addListener(overlayListener);
            overlayOpacitySlider.valueProperty().addListener(overlayListener);
            selectedLevelsField.setOnAction(event -> emitCurrentOverlay());
            ChangeListener<Object> popupOverlayListener = (ignored, before, after) -> emitCurrentPopupOverlay();
            popupOverlayRangeSpinner.valueProperty().addListener(popupOverlayListener);
            popupOverlayOpacitySlider.valueProperty().addListener(popupOverlayListener);
            popupSelectedLevelsField.setOnAction(event -> emitCurrentPopupOverlay());
        }

        private void showOverlay(DungeonEditorControlsContentModel.OverlayPanelState panelState) {
            overlayTrigger.setText(panelState.triggerText());
            selectOverlayMode(overlayModeSelector, panelState.modeKey());
            setSpinnerValue(overlayRangeSpinner, panelState.levelRange());
            overlayOpacitySlider.setValue(panelState.opacityPercent());
            overlayOpacityLabel.setText(panelState.opacityText());
            selectedLevelsField.setText(panelState.selectedLevelsText());
            markPopupOverlayModeButtons(panelState.modeKey());
            setSpinnerValue(popupOverlayRangeSpinner, panelState.levelRange());
            popupOverlayOpacitySlider.setValue(panelState.opacityPercent());
            popupOverlayOpacityLabel.setText(panelState.opacityText());
            popupSelectedLevelsField.setText(panelState.selectedLevelsText());
            overlayTrigger.setDisable(panelState.controlsDisabled());
            overlayModeSelector.setDisable(panelState.controlsDisabled());
            overlayOpacitySlider.setDisable(panelState.controlsDisabled());
            setNodeVisibility(overlayRangeRow, panelState.rangeVisible());
            setNodeVisibility(selectedLevelsRow, panelState.selectedVisible());
            overlayRangeSpinner.setDisable(panelState.controlsDisabled() || !panelState.rangeVisible());
            selectedLevelsField.setDisable(panelState.controlsDisabled() || !panelState.selectedVisible());
            popupOverlayModeRow.setDisable(panelState.controlsDisabled());
            popupOverlayOpacitySlider.setDisable(panelState.controlsDisabled());
            setNodeVisibility(popupOverlayRangeRow, panelState.rangeVisible());
            setNodeVisibility(popupSelectedLevelsRow, panelState.selectedVisible());
            popupOverlayRangeSpinner.setDisable(panelState.controlsDisabled() || !panelState.rangeVisible());
            popupSelectedLevelsField.setDisable(panelState.controlsDisabled() || !panelState.selectedVisible());
        }

        private void emitCurrentOverlay() {
            emitOverlayInput(
                    rendering,
                    selectedOverlayModeKey(overlayModeSelector),
                    spinnerValue(overlayRangeSpinner),
                    overlayOpacitySlider.getValue() / 100.0,
                    selectedLevelsField.getText());
        }

        private void emitCurrentPopupOverlay() {
            emitCurrentPopupOverlay(selectedPopupOverlayModeKey());
        }

        private void emitCurrentPopupOverlay(String modeKey) {
            emitOverlayInput(
                    rendering,
                    modeKey,
                    spinnerValue(popupOverlayRangeSpinner),
                    popupOverlayOpacitySlider.getValue() / 100.0,
                    popupSelectedLevelsField.getText());
        }

        private void showOverlayPopup() {
            HBox popupContent = styled(
                    row(
                            popupOverlayModeRow,
                            row(new Label("Staerke"), popupOverlayOpacitySlider, popupOverlayOpacityLabel),
                            popupOverlayRangeRow,
                            popupSelectedLevelsRow),
                    "dropdown-window",
                    "dropdown-form",
                    "dungeon-editor-popup");
            popupContent.setOnMouseExited(event -> overlayMenu.hide());
            overlayMenu.getItems().setAll(new CustomMenuItem(popupContent, false));
            overlayMenu.show(overlayTrigger, Side.BOTTOM, 0.0, 2.0);
        }

        private void replacePopupOverlayModeButtons(
                List<DungeonEditorControlsContentModel.OverlayModeOption> options
        ) {
            popupOverlayModeRow.getChildren().clear();
            for (DungeonEditorControlsContentModel.OverlayModeOption option : options) {
                popupOverlayModeRow.getChildren().add(popupOverlayModeButton(option));
            }
        }

        private Button popupOverlayModeButton(DungeonEditorControlsContentModel.OverlayModeOption option) {
            Button button = toolButton(option.label());
            button.setUserData(option);
            button.setOnAction(event -> emitCurrentPopupOverlay(option.key()));
            return button;
        }

        private void markPopupOverlayModeButtons(String modeKey) {
            for (Node node : popupOverlayModeRow.getChildren()) {
                if (node instanceof Button button
                        && button.getUserData()
                        instanceof DungeonEditorControlsContentModel.OverlayModeOption option) {
                    boolean selected = option.key().equals(modeKey);
                    setStyleClassPresence(button, SELECTED_STYLE_CLASS, selected);
                    button.setAccessibleText("Overlay-Modus " + option.label() + (selected ? " aktiv" : " waehlen"));
                }
            }
        }

        private String selectedPopupOverlayModeKey() {
            for (Node node : popupOverlayModeRow.getChildren()) {
                if (node instanceof Button button
                        && button.getStyleClass().contains(SELECTED_STYLE_CLASS)
                        && button.getUserData()
                        instanceof DungeonEditorControlsContentModel.OverlayModeOption option) {
                    return option.key();
                }
            }
            return selectedOverlayModeKey(overlayModeSelector);
        }
    }

    private final class ToolSection extends HBox {

        private final ContextMenu optionMenu = new ContextMenu();
        private final ToggleButton selectButton;
        private final Button roomButton;
        private final Button wallButton;
        private final Button doorButton;
        private final Button corridorButton;
        private final Button featureButton;
        private final Button stairButton;
        private final Button transitionButton;

        private ToolSection(DungeonEditorControlsContentModel.ToolControls toolControls) {
            selectButton = toolToggle(toolControls.select().label());
            roomButton = toolButton(toolControls.room().label());
            wallButton = toolButton(toolControls.wall().label());
            doorButton = toolButton(toolControls.door().label());
            corridorButton = toolButton(toolControls.corridor().label());
            featureButton = toolButton(toolControls.feature().label());
            stairButton = toolButton(toolControls.stair().label());
            transitionButton = toolButton(toolControls.transition().label());
            optionMenu.setAutoHide(true);
            styled(this, controlRowStyle(), "dungeon-control-tool-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
            replaceChildren(
                    this,
                    selectButton,
                    roomButton,
                    wallButton,
                    doorButton,
                    corridorButton,
                    featureButton,
                    stairButton,
                    transitionButton);
            configureToolControls(toolControls);
        }

        private void bind(
                DungeonEditorControlsContentModel contentModel,
                DungeonEditorControlsContentModel.ToolControls toolControls
        ) {
            contentModel.toolProjectionProperty().addListener((ignored, before, after) -> show(after, toolControls));
            show(contentModel.toolProjectionProperty().get(), toolControls);
        }

        private void configureToolControls(DungeonEditorControlsContentModel.ToolControls toolControls) {
            ToggleGroup toolGroup = new ToggleGroup();
            selectButton.setToggleGroup(toolGroup);
            selectButton.setSelected(true);
            selectButton.setAccessibleText("Auswahlwerkzeug aktivieren");
            selectButton.setOnAction(event -> emitToolSelection("", toolControls.select().key()));
        }

        private void configureFamilyButton(
                Button button,
                DungeonEditorControlsContentModel.ToolFamilyButton family,
                String selectToolKey
        ) {
            button.setAccessibleText(family.label() + "werkzeug wählen");
            button.setOnAction(event -> activateFamily(button, family, selectToolKey));
        }

        private void activateFamily(
                Button anchor,
                DungeonEditorControlsContentModel.ToolFamilyButton family,
                String selectToolKey
        ) {
            DungeonEditorControlsContentModel.ToolButton selectedOption = family.selectedOption();
            String selectedOptionKey = selectedOption.key();
            emitToolSelection(family.familyKey(), selectedOption.toolKey(), selectedOptionKey);
            if (family.hasSecondaryOptions()) {
                showFamilyOptions(anchor, family, selectedOptionKey, selectToolKey);
            } else {
                optionMenu.hide();
            }
        }

        private void showFamilyOptions(
                Button anchor,
                DungeonEditorControlsContentModel.ToolFamilyButton family,
                String selectedOptionKey,
                String selectToolKey
        ) {
            HBox options = row();
            for (DungeonEditorControlsContentModel.ToolButton option : family.options()) {
                options.getChildren().add(optionButton(family.familyKey(), option, selectedOptionKey));
            }
            options.getStyleClass().addAll("dropdown-window", "dropdown-form", "dungeon-editor-popup");
            options.setOnMouseExited(event -> optionMenu.hide());
            options.addEventHandler(KeyEvent.KEY_PRESSED, event -> {
                if (event.getCode() == KeyCode.ESCAPE) {
                    emitToolSelection("", selectToolKey);
                    optionMenu.hide();
                    event.consume();
                }
            });
            CustomMenuItem item = new CustomMenuItem(options, false);
            optionMenu.getItems().setAll(item);
            optionMenu.show(anchor, Side.BOTTOM, 0.0, 2.0);
            requestOptionFocus(options, selectedOptionKey);
        }

        private Button optionButton(
                String familyKey,
                DungeonEditorControlsContentModel.ToolButton option,
                String selectedOptionKey
        ) {
            Button button = toolButton(option.label());
            boolean selected = option.key().equals(selectedOptionKey);
            setStyleClassPresence(button, SELECTED_STYLE_CLASS, selected);
            button.setDisable(!option.enabled());
            button.setAccessibleText(option.label()
                    + (option.enabled() ? (selected ? " aktiv" : " wählen") : " noch nicht verfügbar"));
            if (option.enabled()) {
                button.setOnAction(event -> {
                    emitToolSelection(familyKey, option.toolKey(), option.key());
                    optionMenu.hide();
                });
            }
            return button;
        }

        private void requestOptionFocus(HBox options, String selectedOptionKey) {
            Node fallbackOption = null;
            for (Node node : options.getChildren()) {
                if (fallbackOption == null) {
                    fallbackOption = node;
                }
                if (node instanceof Button button && button.getStyleClass().contains(SELECTED_STYLE_CLASS)) {
                    button.requestFocus();
                    return;
                }
            }
            if (fallbackOption != null) {
                fallbackOption.requestFocus();
            }
        }

        private void show(
                DungeonEditorControlsContentModel.ToolProjection projection,
                DungeonEditorControlsContentModel.ToolControls toolControls
        ) {
            String defaultToolLabel = toolControls.defaultTool();
            String selectedTool = projection == null ? defaultToolLabel : projection.selectedTool();
            DungeonEditorControlsContentModel.ToolControls currentToolControls =
                    projection == null ? toolControls : projection.toolControls();
            selectButton.setSelected(defaultToolLabel.equals(selectedTool));
            if (defaultToolLabel.equals(selectedTool)) {
                optionMenu.hide();
            }
            String selectToolKey = currentToolControls.select().key();
            bindFamilyButton(roomButton, selectedTool, currentToolControls.room(), selectToolKey);
            bindFamilyButton(wallButton, selectedTool, currentToolControls.wall(), selectToolKey);
            bindFamilyButton(doorButton, selectedTool, currentToolControls.door(), selectToolKey);
            bindFamilyButton(corridorButton, selectedTool, currentToolControls.corridor(), selectToolKey);
            bindFamilyButton(featureButton, selectedTool, currentToolControls.feature(), selectToolKey);
            bindFamilyButton(stairButton, selectedTool, currentToolControls.stair(), selectToolKey);
            bindFamilyButton(transitionButton, selectedTool, currentToolControls.transition(), selectToolKey);
        }

        private void bindFamilyButton(
                Button button,
                String selectedTool,
                DungeonEditorControlsContentModel.ToolFamilyButton family,
                String selectToolKey
        ) {
            configureFamilyButton(button, family, selectToolKey);
            markSelectedFamily(button, selectedTool, family, family.selectedOptionKey());
        }
    }

    private void handleViewModeChanged(
            boolean[] rendering,
            Toggle oldToggle,
            Toggle newToggle,
            ToggleButton graphButton,
            ToggleButton gridButton,
            DungeonEditorControlsContentModel.ToolControls toolControls
    ) {
        if (rendering[0]) {
            return;
        }
        if (newToggle == null) {
            if (oldToggle != null) {
                oldToggle.setSelected(true);
            }
            return;
        }
        if (newToggle.equals(graphButton)) {
            emitViewMode(toolControls.graphView());
            return;
        }
        gridButton.setSelected(true);
        emitViewMode(toolControls.gridView());
    }

    private void emitViewMode(String viewModeKey) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot(viewModeKey, 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitProjectionShift(int projectionLevelShift) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", projectionLevelShift),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitToolSelection(String requestedFamilyKey, String selectedToolKey) {
        emitToolSelection(requestedFamilyKey, selectedToolKey, selectedToolKey);
    }

    private void emitToolSelection(String requestedFamilyKey, String selectedToolKey, String selectedOptionKey) {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot(
                        requestedFamilyKey,
                        selectedToolKey,
                        selectedOptionKey,
                        false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void handleControlsShortcut(KeyEvent event) {
        if (event.getCode() == KeyCode.ESCAPE) {
            emitToolDismiss();
            event.consume();
        }
    }

    private void emitToolDismiss() {
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", true),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot("", 0, 0.0, "")));
    }

    private void emitOverlayInput(
            boolean[] rendering,
            String modeKey,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        if (rendering[0]) {
            return;
        }
        viewInputEventHandler.accept(new DungeonEditorControlsViewInputEvent(
                new DungeonEditorControlsViewInputEvent.MapSnapshot(0L, "", false, false, false, false, false, false, false, false),
                new DungeonEditorControlsViewInputEvent.ToolSnapshot("", "", false),
                new DungeonEditorControlsViewInputEvent.ProjectionSnapshot("", 0),
                new DungeonEditorControlsViewInputEvent.OverlaySnapshot(modeKey, levelRange, opacity, selectedLevelsText)));
    }

    private static HBox row(Node... nodes) {
        HBox row = new HBox(6, nodes);
        styled(row, controlRowStyle());
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static String controlRowStyle() {
        return "dungeon-control-row";
    }

    private static HBox group(Node... nodes) {
        HBox group = new HBox(0, nodes);
        styled(group, "dungeon-control-group");
        group.setAlignment(Pos.CENTER_LEFT);
        group.setMaxWidth(USE_PREF_SIZE);
        return group;
    }

    private static Button actionButton(String text) {
        Button button = styled(new Button(text), "toolbar-action-button");
        button.setMinWidth(USE_PREF_SIZE);
        return button;
    }

    private static ToggleButton toolToggle(String text) {
        ToggleButton button = styled(new ToggleButton(text), "tool-btn");
        configureToolButton(button);
        return button;
    }

    private static Button toolButton(String text) {
        Button button = styled(new Button(text), "tool-btn");
        configureToolButton(button);
        return button;
    }

    private static void configureToolButton(javafx.scene.control.ButtonBase button) {
        button.setMinWidth(0.0);
        button.setMaxWidth(Double.MAX_VALUE);
        button.setTextOverrun(OverrunStyle.ELLIPSIS);
        HBox.setHgrow(button, Priority.ALWAYS);
    }

    private static Label mutedLabel(String text) {
        return styled(new Label(text == null ? "" : text), "text-muted");
    }

    private static void selectOverlayMode(
            ComboBox<Object> modeSelector,
            String modeKey
    ) {
        for (Object item : comboItems(modeSelector)) {
            DungeonEditorControlsContentModel.OverlayModeOption option = asOverlayModeOption(item);
            if (option.key().equals(modeKey)) {
                modeSelector.setValue(option);
                return;
            }
        }
        DungeonEditorControlsContentModel.OverlayModeOption firstOption =
                asOverlayModeOption(firstComboItem(modeSelector));
        if (firstOption != null) {
            modeSelector.setValue(firstOption);
        }
    }

    private static String selectedOverlayModeKey(
            ComboBox<Object> modeSelector
    ) {
        DungeonEditorControlsContentModel.OverlayModeOption option = asOverlayModeOption(comboValue(modeSelector));
        return option == null ? "" : option.key();
    }

    private static void markSelectedFamily(
            Button button,
            String selectedTool,
            DungeonEditorControlsContentModel.ToolFamilyButton family,
            String selectedOptionKey
    ) {
        boolean selected = family.selectedByLabel(selectedTool);
        DungeonEditorControlsContentModel.ToolButton option = toolOption(family, selectedOptionKey);
        setStyleClassPresence(button, SELECTED_STYLE_CLASS, selected);
        button.setAccessibleText(family.label() + "werkzeug"
                + (selected ? " aktiv, Option " + option.label() : ", letzte Option " + option.label()));
    }

    private static DungeonEditorControlsContentModel.ToolButton toolOption(
            DungeonEditorControlsContentModel.ToolFamilyButton family,
            String selectedOptionKey
    ) {
        for (DungeonEditorControlsContentModel.ToolButton option : family.options()) {
            if (option.key().equals(selectedOptionKey)) {
                return option;
            }
        }
        return family.selectedOption();
    }

    private static void setNodeVisibility(Node node, boolean visible) {
        node.setVisible(visible);
        node.setManaged(visible);
    }

    private static <T extends Node> T styled(T node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
        return node;
    }

    private static void setStyleClassPresence(Node node, String styleClass, boolean present) {
        if (present && !node.getStyleClass().contains(styleClass)) {
            node.getStyleClass().add(styleClass);
        }
        if (!present) {
            node.getStyleClass().remove(styleClass);
        }
    }

    private static void replaceChildren(Pane pane, Node... nodes) {
        pane.getChildren().setAll(nodes);
    }

    private static <T> void replaceComboItems(ComboBox<T> comboBox, List<? extends T> items) {
        comboBox.getItems().setAll(items);
    }

    private static <T> List<T> comboItems(ComboBox<T> comboBox) {
        return comboBox.getItems();
    }

    private static <T> @Nullable T firstComboItem(ComboBox<T> comboBox) {
        Iterator<T> items = comboItems(comboBox).iterator();
        return items.hasNext() ? items.next() : null;
    }

    private static void setSpinnerValue(Spinner<Integer> spinner, int value) {
        if (spinner.getValueFactory() != null) {
            spinner.getValueFactory().setValue(value);
        }
    }

    private static <T> @Nullable T comboValue(ComboBox<T> comboBox) {
        return comboBox.getValue();
    }

    private static int spinnerValue(Spinner<Integer> spinner) {
        Integer value = spinner.getValue();
        return value == null ? 0 : value;
    }

    private static DungeonEditorControlsContentModel.@Nullable OverlayModeOption asOverlayModeOption(
            @Nullable Object value
    ) {
        return value instanceof DungeonEditorControlsContentModel.OverlayModeOption option ? option : null;
    }
}
