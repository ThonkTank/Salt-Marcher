package features.world.dungeonmap.shell.controls;

import features.world.dungeonmap.map.state.DungeonLevelOverlayMode;
import features.world.dungeonmap.map.state.DungeonLevelOverlaySettings;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import ui.components.AnchoredDropdown;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

public final class DungeonLevelOverlayControls {

    private final Button triggerButton = new Button();
    private final ComboBox<DungeonLevelOverlayMode> modeSelector = new ComboBox<>();
    private final Spinner<Integer> rangeSpinner = new Spinner<>();
    private final Slider opacitySlider = new Slider(10, 90, 35);
    private final Label opacityLabel = new Label();
    private final TextField selectedLevelsField = new TextField();
    private final HBox rangeRow;
    private final HBox selectedRow;
    private final VBox dropdownContent;
    private final AnchoredDropdown dropdown;

    private Consumer<DungeonLevelOverlayMode> onModeChanged = ignored -> {};
    private Consumer<Integer> onRangeChanged = ignored -> {};
    private Consumer<Double> onOpacityChanged = ignored -> {};
    private Consumer<List<Integer>> onSelectedLevelsChanged = ignored -> {};
    private boolean syncing;
    private List<Integer> displayedSelectedLevels = List.of();

    public DungeonLevelOverlayControls(Function<String, Label> sectionLabelFactory) {
        modeSelector.getItems().setAll(DungeonLevelOverlayMode.values());
        modeSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonLevelOverlayMode mode) {
                return mode == null ? "" : mode.label();
            }

            @Override
            public DungeonLevelOverlayMode fromString(String string) {
                return null;
            }
        });
        modeSelector.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(modeSelector, Priority.ALWAYS);

        SpinnerValueFactory.IntegerSpinnerValueFactory rangeFactory =
                new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 6, 1);
        rangeSpinner.setValueFactory(rangeFactory);
        rangeSpinner.setEditable(true);
        rangeSpinner.setPrefWidth(84);

        opacitySlider.setShowTickMarks(false);
        opacitySlider.setShowTickLabels(false);
        opacitySlider.setPrefWidth(170);
        HBox.setHgrow(opacitySlider, Priority.ALWAYS);
        opacityLabel.setMinWidth(Region.USE_PREF_SIZE);

        selectedLevelsField.setPromptText("-1, 1, 3");
        selectedLevelsField.setPrefColumnCount(10);
        HBox.setHgrow(selectedLevelsField, Priority.ALWAYS);

        triggerButton.getStyleClass().addAll("toolbar-action-button", "dungeon-overlay-trigger");
        triggerButton.setMinWidth(Region.USE_PREF_SIZE);
        triggerButton.setOnAction(event -> toggleDropdown());

        HBox modeRow = row(new Label("Modus"), modeSelector);
        rangeRow = row(new Label("Umfang"), rangeSpinner);
        HBox opacityRow = row(new Label("Stärke"), opacitySlider, opacityLabel);
        selectedRow = row(new Label("Ebenen"), selectedLevelsField);
        dropdownContent = new VBox(6, sectionLabelFactory.apply("Overlay"), modeRow, opacityRow, rangeRow, selectedRow);
        dropdownContent.getStyleClass().addAll("dropdown-window", "dropdown-form", "dungeon-overlay-dropdown");
        dropdownContent.setMaxWidth(Double.MAX_VALUE);
        dropdown = new AnchoredDropdown(dropdownContent);

        modeSelector.getSelectionModel().selectedItemProperty().addListener((obs, oldValue, newValue) -> {
            if (syncing || newValue == null) {
                return;
            }
            updateEnabledState(newValue, triggerButton.isDisabled());
            onModeChanged.accept(newValue);
        });
        rangeSpinner.valueProperty().addListener((obs, oldValue, newValue) -> {
            if (!syncing && newValue != null) {
                onRangeChanged.accept(newValue);
            }
        });
        opacitySlider.valueProperty().addListener((obs, oldValue, newValue) -> {
            updateOpacityLabel();
            if (!syncing && newValue != null) {
                onOpacityChanged.accept(newValue.doubleValue() / 100.0);
            }
        });
        selectedLevelsField.setOnAction(event -> commitSelectedLevels());
        selectedLevelsField.focusedProperty().addListener((obs, oldValue, focused) -> {
            if (!focused) {
                commitSelectedLevels();
            }
        });
        showSettings(DungeonLevelOverlaySettings.defaults(), false);
    }

    public Node trigger() {
        return triggerButton;
    }

    public void setOnModeChanged(Consumer<DungeonLevelOverlayMode> onModeChanged) {
        this.onModeChanged = onModeChanged == null ? ignored -> {} : onModeChanged;
    }

    public void setOnRangeChanged(Consumer<Integer> onRangeChanged) {
        this.onRangeChanged = onRangeChanged == null ? ignored -> {} : onRangeChanged;
    }

    public void setOnOpacityChanged(Consumer<Double> onOpacityChanged) {
        this.onOpacityChanged = onOpacityChanged == null ? ignored -> {} : onOpacityChanged;
    }

    public void setOnSelectedLevelsChanged(Consumer<List<Integer>> onSelectedLevelsChanged) {
        this.onSelectedLevelsChanged = onSelectedLevelsChanged == null ? ignored -> {} : onSelectedLevelsChanged;
    }

    public void showSettings(DungeonLevelOverlaySettings settings, boolean disabled) {
        DungeonLevelOverlaySettings resolved = settings == null ? DungeonLevelOverlaySettings.defaults() : settings;
        syncing = true;
        modeSelector.getSelectionModel().select(resolved.mode());
        rangeSpinner.getValueFactory().setValue(resolved.levelRange());
        opacitySlider.setValue(resolved.opacity() * 100.0);
        displayedSelectedLevels = resolved.selectedLevels();
        selectedLevelsField.setText(formatLevels(displayedSelectedLevels));
        updateOpacityLabel();
        triggerButton.setText(summaryText(resolved));
        triggerButton.setDisable(disabled);
        modeSelector.setDisable(disabled);
        opacitySlider.setDisable(disabled);
        updateEnabledState(resolved.mode(), disabled);
        syncing = false;
    }

    private void commitSelectedLevels() {
        if (syncing) {
            return;
        }
        List<Integer> parsedLevels = parseLevels(selectedLevelsField.getText());
        if (parsedLevels == null) {
            selectedLevelsField.setText(formatLevels(displayedSelectedLevels));
            return;
        }
        displayedSelectedLevels = parsedLevels;
        selectedLevelsField.setText(formatLevels(parsedLevels));
        onSelectedLevelsChanged.accept(parsedLevels);
    }

    private void updateEnabledState(DungeonLevelOverlayMode mode, boolean globalDisabled) {
        DungeonLevelOverlayMode resolvedMode = mode == null ? DungeonLevelOverlayMode.OFF : mode;
        boolean rangeVisible = resolvedMode.usesRange();
        boolean selectedVisible = resolvedMode.usesSelectedLevels();
        rangeRow.setManaged(rangeVisible);
        rangeRow.setVisible(rangeVisible);
        selectedRow.setManaged(selectedVisible);
        selectedRow.setVisible(selectedVisible);
        rangeSpinner.setDisable(globalDisabled || !rangeVisible);
        selectedLevelsField.setDisable(globalDisabled || !selectedVisible);
    }

    private void updateOpacityLabel() {
        opacityLabel.setText(Math.round(opacitySlider.getValue()) + "%");
    }

    private void toggleDropdown() {
        if (triggerButton.isDisabled()) {
            return;
        }
        if (dropdown.isShowing()) {
            dropdown.hide();
            return;
        }
        dropdown.show(triggerButton, AnchoredDropdown.HorizontalAlignment.LEFT, 2);
        dropdown.requestFocus(modeSelector);
    }

    private static HBox row(Region... nodes) {
        HBox row = new HBox(8, nodes);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    private static String summaryText(DungeonLevelOverlaySettings settings) {
        return switch (settings.mode()) {
            case OFF -> "Overlay: Aus";
            case NEARBY -> "Overlay: Nachbarn · ±" + settings.levelRange() + " · " + percentageText(settings.opacity());
            case SELECTED -> "Overlay: Auswahl · z=" + levelsSummary(settings.selectedLevels()) + " · " + percentageText(settings.opacity());
        };
    }

    private static String levelsSummary(List<Integer> levels) {
        String formatted = formatLevels(levels);
        return formatted.isBlank() ? "-" : formatted;
    }

    private static String percentageText(double opacity) {
        return Math.round(opacity * 100.0) + "%";
    }

    private static String formatLevels(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    private static List<Integer> parseLevels(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return List.of(raw.split("[,\\s]+")).stream()
                    .map(String::trim)
                    .filter(token -> !token.isBlank())
                    .map(Integer::parseInt)
                    .distinct()
                    .sorted()
                    .toList();
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
