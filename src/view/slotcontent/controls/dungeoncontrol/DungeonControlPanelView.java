package src.view.slotcontent.controls.dungeoncontrol;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public class DungeonControlPanelView extends VBox {

    private final DungeonControlPanelContentModel contentModel = new DungeonControlPanelContentModel();
    private Consumer<DungeonControlPanelViewInputEvent> viewInputEventHandler = ignored -> { };

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonControlPanelView(String titleText) {
        setSpacing(6);
        setPadding(new Insets(8));
        getStyleClass().add("surface-root");
        if (titleText != null && !titleText.isBlank()) {
            getChildren().add(new Label(titleText));
        }
    }

    protected final void addControl(Node control) {
        getChildren().add(control);
    }

    protected final HBox compactControlRow(Node... controls) {
        HBox row = new HBox(6, controls);
        FxAccess.addStyle(row, "dungeon-control-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    protected final HBox compactControlGroup(Node... controls) {
        HBox group = new HBox(0, controls);
        FxAccess.addStyle(group, "dungeon-control-group");
        group.setAlignment(Pos.CENTER_LEFT);
        group.setMaxWidth(USE_PREF_SIZE);
        return group;
    }

    protected final ScrollPane compactControlScroller(Node content) {
        ScrollPane scroller = new ScrollPane(content);
        FxAccess.addStyle(scroller, "dungeon-control-scroll");
        scroller.setFitToHeight(true);
        scroller.setFitToWidth(false);
        scroller.setHbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        scroller.setVbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scroller;
    }

    protected final void describe(Node node, String description) {
        if (node == null || description == null || description.isBlank()) {
            return;
        }
        node.setAccessibleText(description);
        if (node instanceof Control control) {
            control.setTooltip(new Tooltip(description));
        }
    }

    protected final Label sectionLabel(String text) {
        Label label = new Label(text);
        FxAccess.addStyles(label, "section-header", "text-muted");
        return label;
    }

    protected final Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    public void onViewInputEvent(Consumer<DungeonControlPanelViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public final DungeonControlPanelContentModel contentModel() {
        return contentModel;
    }

    public final OverlayControlsPanel newOverlayControls() {
        return new OverlayControlsPanel();
    }

    private void publish(DungeonControlPanelViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    public final class OverlayControlsPanel {

        private final Button triggerButton = new Button();
        private final OverlayPopupContentView popupContent = new OverlayPopupContentView();
        private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
        private final AnchoredPopupView popup = new AnchoredPopupView(
                popupContent,
                () -> triggerButton,
                popupContent::focusTarget);

        private OverlayControlsPanel() {
            popup.bind(popupContentModel);
            FxAccess.addStyles(triggerButton, "toolbar-action-button", "dungeon-overlay-trigger");
            triggerButton.setMinWidth(USE_PREF_SIZE);
            triggerButton.setOnAction(event -> togglePopup());
            contentModel.overlaySettingsProperty().addListener((ignored, before, after) -> showState());
            contentModel.overlayDisabledProperty().addListener((ignored, before, after) -> showState());
            showState();
        }

        public Node trigger() {
            return triggerButton;
        }

        private void showState() {
            DungeonControlPanelContentModel.OverlayPanelState panelState = contentModel.currentOverlayPanelState();
            popupContent.showSettings(panelState);
            triggerButton.setText(panelState.triggerText());
            triggerButton.setDisable(panelState.controlsDisabled());
        }

        private void togglePopup() {
            if (triggerButton.isDisabled()) {
                return;
            }
            if (popupContentModel.isOpen()) {
                popupContentModel.hide();
                return;
            }
            popupContentModel.showBelow(2.0, true);
        }
    }

    private final class OverlayPopupContentView extends VBox {

        private final ComboBox<DungeonControlPanelContentModel.Mode> modeSelector = new ComboBox<>();
        private final Spinner<Integer> rangeSpinner = new Spinner<>(1, 6, 2);
        private final Slider opacitySlider = new Slider(10, 90, 35);
        private final Label opacityLabel = new Label();
        private final TextField selectedLevelsField = new TextField();
        private final HBox rangeRow;
        private final HBox selectedRow;
        private boolean syncing;
        private List<Integer> displayedSelectedLevels = List.of();

        private OverlayPopupContentView() {
            super(6);
            FxAccess.setComboItems(modeSelector, DungeonControlPanelContentModel.Mode.values());
            modeSelector.setConverter(new StringConverter<>() {
                @Override
                public String toString(DungeonControlPanelContentModel.Mode mode) {
                    return mode == null ? "" : mode.label();
                }

                @Override
                public DungeonControlPanelContentModel.Mode fromString(String string) {
                    return null;
                }
            });
            modeSelector.setMaxWidth(Double.MAX_VALUE);
            HBox.setHgrow(modeSelector, Priority.ALWAYS);

            rangeSpinner.setEditable(true);
            rangeSpinner.setPrefWidth(84);

            opacitySlider.setShowTickMarks(false);
            opacitySlider.setShowTickLabels(false);
            HBox.setHgrow(opacitySlider, Priority.ALWAYS);
            opacityLabel.setMinWidth(USE_PREF_SIZE);

            selectedLevelsField.setPromptText("-1, 1, 3");
            selectedLevelsField.setPrefColumnCount(10);
            HBox.setHgrow(selectedLevelsField, Priority.ALWAYS);

            HBox modeRow = row(new Label("Modus"), modeSelector);
            HBox opacityRow = row(new Label("Staerke"), opacitySlider, opacityLabel);
            rangeRow = row(new Label("Umfang"), rangeSpinner);
            selectedRow = row(new Label("Ebenen"), selectedLevelsField);
            getChildren().addAll(sectionLabel("Overlay"), modeRow, opacityRow, rangeRow, selectedRow);
            setPadding(new Insets(8));
            getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
            configureListeners();
        }

        private Node focusTarget() {
            return modeSelector;
        }

        private void showSettings(DungeonControlPanelContentModel.OverlayPanelState panelState) {
            syncing = true;
            modeSelector.setValue(panelState.mode());
            FxAccess.setSpinnerValue(rangeSpinner, panelState.levelRange());
            opacitySlider.setValue(panelState.opacityPercent());
            selectedLevelsField.setText(panelState.selectedLevelsText());
            displayedSelectedLevels = contentModel.parseLevels(panelState.selectedLevelsText()).orElse(List.of());
            updateOpacityLabel(panelState.opacityPercent());
            modeSelector.setDisable(panelState.controlsDisabled());
            opacitySlider.setDisable(panelState.controlsDisabled());
            applyVisibility(panelState);
            syncing = false;
        }

        private void configureListeners() {
            modeSelector.valueProperty().addListener((ignored, before, after) -> {
                if (syncing || after == null) {
                    return;
                }
                applyVisibility(DungeonControlPanelContentModel.OverlayPanelState.from(
                        new DungeonControlPanelContentModel.OverlaySettings(
                                after,
                                rangeSpinner.getValue(),
                                opacitySlider.getValue() / 100.0,
                                displayedSelectedLevels),
                        modeSelector.isDisabled()));
                publishOverlayInput();
            });
            rangeSpinner.valueProperty().addListener((ignored, before, after) -> {
                if (!syncing && after != null) {
                    publishOverlayInput();
                }
            });
            opacitySlider.valueProperty().addListener((ignored, before, after) -> {
                updateOpacityLabel(opacitySlider.getValue());
                if (!syncing && after != null) {
                    publishOverlayInput();
                }
            });
            selectedLevelsField.setOnAction(event -> commitSelectedLevels());
            selectedLevelsField.focusedProperty().addListener((ignored, before, focused) -> {
                if (!focused) {
                    commitSelectedLevels();
                }
            });
        }

        private void publishOverlayInput() {
            publish(new DungeonControlPanelViewInputEvent(new DungeonControlPanelViewInputEvent.OverlayInput(
                    currentModeName(),
                    rangeSpinner.getValue() == null ? 0 : rangeSpinner.getValue(),
                    opacitySlider.getValue() / 100.0,
                    selectedLevelsField.getText())));
        }

        private String currentModeName() {
            DungeonControlPanelContentModel.Mode currentMode = FxAccess.comboValue(modeSelector);
            return currentMode == null ? "" : currentMode.name();
        }

        private void commitSelectedLevels() {
            if (syncing) {
                return;
            }
            java.util.Optional<List<Integer>> parsedLevels =
                    DungeonControlPanelContentModel.parseLevels(selectedLevelsField.getText());
            if (parsedLevels.isEmpty()) {
                selectedLevelsField.setText(contentModel.normalizeSelectedLevelsDraft(
                        selectedLevelsField.getText(),
                        displayedSelectedLevels));
                return;
            }
            displayedSelectedLevels = parsedLevels.orElseThrow();
            selectedLevelsField.setText(contentModel.normalizeSelectedLevelsDraft(
                    selectedLevelsField.getText(),
                    displayedSelectedLevels));
            publishOverlayInput();
        }

        private void applyVisibility(DungeonControlPanelContentModel.OverlayPanelState panelState) {
            rangeRow.setManaged(panelState.rangeVisible());
            rangeRow.setVisible(panelState.rangeVisible());
            selectedRow.setManaged(panelState.selectedVisible());
            selectedRow.setVisible(panelState.selectedVisible());
            rangeSpinner.setDisable(panelState.rangeDisabled());
            selectedLevelsField.setDisable(panelState.selectedLevelsDisabled());
        }

        private void updateOpacityLabel(double opacityPercent) {
            opacityLabel.setText(Math.round(opacityPercent) + "%");
        }

        private HBox row(Node... nodes) {
            HBox row = new HBox(8, nodes);
            row.setAlignment(Pos.CENTER_LEFT);
            row.setMaxWidth(Double.MAX_VALUE);
            return row;
        }
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class FxAccess {

        private static void addStyle(Node node, String styleClass) {
            node.getStyleClass().add(styleClass);
        }

        private static void addStyles(Node node, String... styleClasses) {
            node.getStyleClass().addAll(styleClasses);
        }

        private static <T> void setComboItems(ComboBox<T> comboBox, T[] values) {
            comboBox.getItems().setAll(values);
        }

        private static <T> T comboValue(ComboBox<T> comboBox) {
            return comboBox.getValue();
        }

        private static <T> void setSpinnerValue(Spinner<T> spinner, T value) {
            if (spinner.getValueFactory() != null) {
                spinner.getValueFactory().setValue(value);
            }
        }
    }
}
