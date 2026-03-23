package features.world.dungeonmap.shell.controls;

import features.world.dungeonmap.state.DungeonLevelOverlayMode;
import features.world.dungeonmap.state.DungeonLevelOverlaySettings;
import javafx.geometry.Pos;
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

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

public final class DungeonLevelOverlayControls {

    private final ComboBox<DungeonLevelOverlayMode> modeSelector = new ComboBox<>();
    private final Spinner<Integer> rangeSpinner = new Spinner<>();
    private final Slider opacitySlider = new Slider(10, 90, 35);
    private final Label opacityLabel = new Label();
    private final TextField selectedLevelsField = new TextField();
    private final VBox content;

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

        HBox modeRow = row(new Label("Overlay"), modeSelector);
        HBox rangeRow = row(new Label("Umfang"), rangeSpinner);
        HBox opacityRow = row(new Label("Stärke"), opacitySlider, opacityLabel);
        HBox selectedRow = row(new Label("Ebenen"), selectedLevelsField);
        content = new VBox(6, sectionLabelFactory.apply("Overlay"), modeRow, rangeRow, opacityRow, selectedRow);
        content.getStyleClass().add("editor-toolbar-group");
        content.setMaxWidth(Double.MAX_VALUE);

        modeSelector.getSelectionModel().selectedItemProperty().addListener((obs, oldValue, newValue) -> {
            if (syncing || newValue == null) {
                return;
            }
            updateEnabledState(newValue);
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

    public VBox content() {
        return content;
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
        updateEnabledState(resolved.mode());
        modeSelector.setDisable(disabled);
        rangeSpinner.setDisable(disabled || !resolved.mode().usesRange());
        opacitySlider.setDisable(disabled);
        selectedLevelsField.setDisable(disabled || !resolved.mode().usesSelectedLevels());
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

    private void updateEnabledState(DungeonLevelOverlayMode mode) {
        DungeonLevelOverlayMode resolvedMode = mode == null ? DungeonLevelOverlayMode.OFF : mode;
        rangeSpinner.setDisable(modeSelector.isDisabled() || !resolvedMode.usesRange());
        selectedLevelsField.setDisable(modeSelector.isDisabled() || !resolvedMode.usesSelectedLevels());
    }

    private void updateOpacityLabel() {
        opacityLabel.setText(Math.round(opacitySlider.getValue()) + "%");
    }

    private static HBox row(Region... nodes) {
        HBox row = new HBox(8, nodes);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
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
