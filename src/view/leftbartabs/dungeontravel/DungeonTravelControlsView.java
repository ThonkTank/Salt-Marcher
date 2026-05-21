package src.view.leftbartabs.dungeontravel;

import java.util.function.Consumer;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class DungeonTravelControlsView extends VBox {

    private Consumer<DungeonTravelControlsViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonTravelControlsView() {
        getStyleClass().addAll("surface-root", "dungeon-control-panel", "control-toolbar");
        setFillWidth(true);
    }

    public void onViewInputEvent(Consumer<DungeonTravelControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonTravelControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        Label mapLabel = toolbarLabel("");
        Button resetViewButton = toolbarButton("Ansicht zurücksetzen");
        Label zoomLabel = toolbarLabel("");
        Label levelLabel = toolbarLabel("");
        Button previousLevelButton = toolbarButton("-");
        Button nextLevelButton = toolbarButton("+");
        Button overlayButton = toolbarButton("");
        ContextMenu overlayMenu = new ContextMenu();
        ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector = new ComboBox<>();
        Spinner<Integer> rangeSpinner = new Spinner<>(1, 6, 2);
        Slider opacitySlider = new Slider(10, 90, 35);
        Label opacityLabel = new Label();
        TextField selectedLevelsField = new TextField();
        HBox rangeRow = popupRow(new Label("Umfang"), rangeSpinner);
        HBox selectedRow = popupRow(new Label("Ebenen"), selectedLevelsField);
        boolean[] syncing = {false};
        configureOverlayPopup(
                contentModel,
                overlayButton,
                overlayMenu,
                modeSelector,
                rangeSpinner,
                opacitySlider,
                opacityLabel,
                selectedLevelsField,
                rangeRow,
                selectedRow,
                syncing);

        mapLabel.textProperty().bind(contentModel.mapNameProperty());
        zoomLabel.textProperty().bind(contentModel.zoomLabelProperty());
        levelLabel.textProperty().bind(contentModel.projectionLevelLabelProperty());
        previousLevelButton.disableProperty().bind(contentModel.projectionNavigationDisabledProperty());
        nextLevelButton.disableProperty().bind(contentModel.projectionNavigationDisabledProperty());
        resetViewButton.setOnAction(event -> publish(
                true,
                0,
                selectedModeKey(modeSelector),
                levelRange(rangeSpinner),
                opacitySlider.getValue(),
                selectedLevelsField.getText()));
        previousLevelButton.setOnAction(event -> publish(
                false,
                -1,
                selectedModeKey(modeSelector),
                levelRange(rangeSpinner),
                opacitySlider.getValue(),
                selectedLevelsField.getText()));
        nextLevelButton.setOnAction(event -> publish(
                false,
                1,
                selectedModeKey(modeSelector),
                levelRange(rangeSpinner),
                opacitySlider.getValue(),
                selectedLevelsField.getText()));
        overlayButton.setOnAction(event -> toggleOverlayMenu(overlayMenu, overlayButton));
        describe(resetViewButton, "Kamera auf die Dungeon-Karte zurücksetzen");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");

        getChildren().setAll(
                controlRow(mapLabel, resetViewButton),
                controlRow(zoomLabel, controlGroup(levelLabel, previousLevelButton, nextLevelButton), overlayButton));
    }

    private void configureOverlayPopup(
            DungeonTravelControlsContentModel contentModel,
            Button overlayButton,
            ContextMenu overlayMenu,
            ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector,
            Spinner<Integer> rangeSpinner,
            Slider opacitySlider,
            Label opacityLabel,
            TextField selectedLevelsField,
            HBox rangeRow,
            HBox selectedRow,
            boolean[] syncing
    ) {
        configurePopupInputs(contentModel, modeSelector, rangeSpinner, opacitySlider, opacityLabel, selectedLevelsField);

        VBox popupContent = new VBox(
                sectionLabel("Overlay"),
                popupRow(new Label("Modus"), modeSelector),
                popupRow(new Label("Staerke"), opacitySlider, opacityLabel),
                rangeRow,
                selectedRow);
        popupContent.getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown", "dungeon-overlay-content");
        overlayMenu.getItems().setAll(new CustomMenuItem(popupContent, false));
        overlayButton.getStyleClass().add("dungeon-overlay-trigger");
        overlayButton.setMinWidth(USE_PREF_SIZE);

        modeSelector.disableProperty().bind(contentModel.overlayDisabledProperty());
        opacitySlider.disableProperty().bind(contentModel.overlayDisabledProperty());
        overlayButton.disableProperty().bind(contentModel.overlayDisabledProperty());
        contentModel.overlayPanelStateProperty().addListener((ignored, before, after) ->
                applyOverlayPanelState(
                        after,
                        overlayButton,
                        modeSelector,
                        rangeSpinner,
                        opacitySlider,
                        opacityLabel,
                        selectedLevelsField,
                        rangeRow,
                        selectedRow,
                        syncing));
        applyOverlayPanelState(
                contentModel.overlayPanelStateProperty().get(),
                overlayButton,
                modeSelector,
                rangeSpinner,
                opacitySlider,
                opacityLabel,
                selectedLevelsField,
                rangeRow,
                selectedRow,
                syncing);

        modeSelector.valueProperty().addListener((ignored, before, after) -> {
            if (syncing[0] || after == null) {
                return;
            }
            showDraftMode(after, rangeRow, selectedRow, rangeSpinner, selectedLevelsField);
            publish(false, 0, after.key(), levelRange(rangeSpinner), opacitySlider.getValue(), selectedLevelsField.getText());
        });
        rangeSpinner.valueProperty().addListener((ignored, before, after) -> {
            if (!syncing[0] && after != null) {
                publish(false, 0, selectedModeKey(modeSelector), after, opacitySlider.getValue(), selectedLevelsField.getText());
            }
        });
        opacitySlider.valueProperty().addListener((ignored, before, after) -> {
            showOpacity(opacityLabel, opacitySlider.getValue());
            if (!syncing[0] && after != null) {
                publish(false, 0, selectedModeKey(modeSelector), levelRange(rangeSpinner), after.doubleValue(), selectedLevelsField.getText());
            }
        });
        selectedLevelsField.setOnAction(event ->
                publishOverlay(modeSelector, rangeSpinner, opacitySlider, selectedLevelsField));
        selectedLevelsField.focusedProperty().addListener((ignored, before, focused) -> {
            if (!focused) {
                publishOverlay(modeSelector, rangeSpinner, opacitySlider, selectedLevelsField);
            }
        });
    }

    private void applyOverlayPanelState(
            DungeonTravelControlsContentModel.OverlayPanelState panelState,
            Button overlayButton,
            ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector,
            Spinner<Integer> rangeSpinner,
            Slider opacitySlider,
            Label opacityLabel,
            TextField selectedLevelsField,
            HBox rangeRow,
            HBox selectedRow,
            boolean[] syncing
    ) {
        syncing[0] = true;
        overlayButton.setText(panelState.triggerText());
        selectMode(modeSelector, panelState.modeKey());
        rangeSpinner.getValueFactory().setValue(panelState.levelRange());
        opacitySlider.setValue(panelState.opacityPercent());
        showOpacity(opacityLabel, panelState.opacityPercent());
        selectedLevelsField.setText(panelState.selectedLevelsText());
        showPanelState(panelState, rangeRow, selectedRow, rangeSpinner, selectedLevelsField);
        syncing[0] = false;
    }

    private void publishOverlay(
            ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector,
            Spinner<Integer> rangeSpinner,
            Slider opacitySlider,
            TextField selectedLevelsField
    ) {
        publish(false, 0, selectedModeKey(modeSelector), levelRange(rangeSpinner), opacitySlider.getValue(), selectedLevelsField.getText());
    }

    private static void toggleOverlayMenu(ContextMenu overlayMenu, Button overlayButton) {
        if (overlayMenu.isShowing()) {
            overlayMenu.hide();
            return;
        }
        overlayMenu.show(overlayButton, Side.BOTTOM, 0.0, 2.0);
    }

    private void publish(
            boolean resetViewRequested,
            int projectionLevelShift,
            String modeKey,
            Integer levelRange,
            double opacityPercent,
            String selectedLevelsText
    ) {
        viewInputEventHandler.accept(new DungeonTravelControlsViewInputEvent(
                resetViewRequested,
                projectionLevelShift,
                modeKey == null ? "" : modeKey,
                levelRange == null ? 0 : levelRange,
                opacityPercent / 100.0,
                selectedLevelsText));
    }

    private static void configurePopupInputs(
            DungeonTravelControlsContentModel contentModel,
            ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector,
            Spinner<Integer> rangeSpinner,
            Slider opacitySlider,
            Label opacityLabel,
            TextField selectedLevelsField
    ) {
        modeSelector.getItems().setAll(contentModel.overlayModeOptions());
        modeSelector.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(modeSelector, Priority.ALWAYS);
        rangeSpinner.setEditable(true);
        rangeSpinner.getStyleClass().add("dungeon-overlay-range-spinner");
        opacitySlider.setShowTickMarks(false);
        opacitySlider.setShowTickLabels(false);
        HBox.setHgrow(opacitySlider, Priority.ALWAYS);
        opacityLabel.setMinWidth(USE_PREF_SIZE);
        selectedLevelsField.setPromptText("-1, 1, 3");
        selectedLevelsField.setPrefColumnCount(10);
        HBox.setHgrow(selectedLevelsField, Priority.ALWAYS);
    }

    private static void selectMode(
            ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector,
            String modeKey
    ) {
        for (DungeonTravelControlsContentModel.OverlayModeOption option : modeSelector.getItems()) {
            if (option.key().equals(modeKey)) {
                modeSelector.setValue(option);
                return;
            }
        }
        if (!modeSelector.getItems().isEmpty()) {
            modeSelector.setValue(modeSelector.getItems().get(0));
        }
    }

    private static void showDraftMode(
            DungeonTravelControlsContentModel.OverlayModeOption option,
            HBox rangeRow,
            HBox selectedRow,
            Spinner<Integer> rangeSpinner,
            TextField selectedLevelsField
    ) {
        rangeRow.setVisible(option.rangeVisible());
        rangeRow.setManaged(option.rangeVisible());
        selectedRow.setVisible(option.selectedLevelsVisible());
        selectedRow.setManaged(option.selectedLevelsVisible());
        rangeSpinner.setDisable(!option.rangeVisible());
        selectedLevelsField.setDisable(!option.selectedLevelsVisible());
    }

    private static void showPanelState(
            DungeonTravelControlsContentModel.OverlayPanelState panelState,
            HBox rangeRow,
            HBox selectedRow,
            Spinner<Integer> rangeSpinner,
            TextField selectedLevelsField
    ) {
        rangeRow.setVisible(panelState.rangeVisible());
        rangeRow.setManaged(panelState.rangeVisible());
        selectedRow.setVisible(panelState.selectedVisible());
        selectedRow.setManaged(panelState.selectedVisible());
        rangeSpinner.setDisable(panelState.rangeDisabled());
        selectedLevelsField.setDisable(panelState.selectedLevelsDisabled());
    }

    private static void showOpacity(Label opacityLabel, double opacityPercent) {
        opacityLabel.setText(Math.round(opacityPercent) + "%");
    }

    private static String selectedModeKey(ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> modeSelector) {
        DungeonTravelControlsContentModel.OverlayModeOption option = modeSelector.getValue();
        return option == null ? "" : option.key();
    }

    private static int levelRange(Spinner<Integer> rangeSpinner) {
        Integer value = rangeSpinner.getValue();
        return value == null ? 0 : value;
    }

    private static HBox controlRow(Node... controls) {
        HBox row = new HBox(6, controls);
        row.getStyleClass().add("dungeon-control-row");
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static HBox controlGroup(Node... controls) {
        HBox group = new HBox(0, controls);
        group.getStyleClass().addAll("dungeon-control-group", "dungeon-stepper-group");
        group.setMaxWidth(USE_PREF_SIZE);
        return group;
    }

    private static HBox popupRow(Node... controls) {
        HBox row = new HBox(8, controls);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static Label toolbarLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setMinWidth(0.0);
        label.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(label, Priority.ALWAYS);
        return label;
    }

    private static Button toolbarButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("toolbar-action-button");
        return button;
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static void describe(Node node, String description) {
        node.setAccessibleText(description);
    }
}
