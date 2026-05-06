package src.view.slotcontent.controls.dungeoncontrol;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

final class OverlayPopupContentView extends VBox {

    private final ComboBox<DungeonControlPanelView.OverlayControlsPanel.Mode> modeSelector = new ComboBox<>();
    private final Spinner<Integer> rangeSpinner = new Spinner<>(1, 6, 2);
    private final Slider opacitySlider = new Slider(10, 90, 35);
    private final Label opacityLabel = new Label();
    private final TextField selectedLevelsField = new TextField();
    private final HBox rangeRow;
    private final HBox selectedRow;
    private final Runnable changePublisher;
    private boolean syncing;
    private boolean globalDisabled;
    private List<Integer> displayedSelectedLevels = List.of();

    OverlayPopupContentView(Function<String, Label> sectionLabelFactory, Runnable changePublisher) {
        super(6);
        this.changePublisher = changePublisher;
        FxAccess.setComboItems(modeSelector, DungeonControlPanelView.OverlayControlsPanel.Mode.values());
        modeSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonControlPanelView.OverlayControlsPanel.Mode mode) {
                return mode == null ? "" : mode.label();
            }

            @Override
            public DungeonControlPanelView.OverlayControlsPanel.Mode fromString(String string) {
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
        getChildren().addAll(sectionLabelFactory.apply("Overlay"), modeRow, opacityRow, rangeRow, selectedRow);
        setPadding(new Insets(8));
        getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
        configureListeners();
    }

    Node focusTarget() {
        return modeSelector;
    }

    void showSettings(DungeonControlPanelView.OverlayControlsPanel.Settings settings, boolean disabled) {
        syncing = true;
        globalDisabled = disabled;
        modeSelector.setValue(settings.mode());
        FxAccess.setSpinnerValue(rangeSpinner, settings.levelRange());
        opacitySlider.setValue(settings.opacity() * 100.0);
        displayedSelectedLevels = settings.selectedLevels();
        selectedLevelsField.setText(Levels.formatLevels(displayedSelectedLevels));
        updateOpacityLabel();
        modeSelector.setDisable(disabled);
        opacitySlider.setDisable(disabled);
        updateEnabledState(settings.mode());
        syncing = false;
    }

    DungeonControlPanelView.OverlayControlsPanel.InputSnapshot snapshot() {
        DungeonControlPanelView.OverlayControlsPanel.Mode selectedMode = FxAccess.comboValue(modeSelector);
        Integer rangeValue = rangeSpinner.getValue();
        return new DungeonControlPanelView.OverlayControlsPanel.InputSnapshot(
                selectedMode == null ? "" : selectedMode.name(),
                rangeValue == null ? 0 : rangeValue,
                opacitySlider.getValue() / 100.0,
                selectedLevelsField.getText());
    }

    private void configureListeners() {
        modeSelector.valueProperty().addListener((ignored, before, after) -> {
            if (syncing || after == null) {
                return;
            }
            updateEnabledState(after);
            changePublisher.run();
        });
        rangeSpinner.valueProperty().addListener((ignored, before, after) -> {
            if (!syncing && after != null) {
                changePublisher.run();
            }
        });
        opacitySlider.valueProperty().addListener((ignored, before, after) -> {
            updateOpacityLabel();
            if (!syncing && after != null) {
                changePublisher.run();
            }
        });
        selectedLevelsField.setOnAction(event -> commitSelectedLevels());
        selectedLevelsField.focusedProperty().addListener((ignored, before, focused) -> {
            if (!focused) {
                commitSelectedLevels();
            }
        });
    }

    private void commitSelectedLevels() {
        if (syncing) {
            return;
        }
        Optional<List<Integer>> parsedLevels = Levels.parseLevels(selectedLevelsField.getText());
        if (parsedLevels.isEmpty()) {
            selectedLevelsField.setText(Levels.formatLevels(displayedSelectedLevels));
            return;
        }
        displayedSelectedLevels = parsedLevels.orElseThrow();
        selectedLevelsField.setText(Levels.formatLevels(displayedSelectedLevels));
        changePublisher.run();
    }

    private void updateEnabledState(DungeonControlPanelView.OverlayControlsPanel.Mode mode) {
        DungeonControlPanelView.OverlayControlsPanel.Mode resolvedMode = mode == null
                ? DungeonControlPanelView.OverlayControlsPanel.Mode.defaultMode()
                : mode;
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

    private static HBox row(Node... nodes) {
        HBox row = new HBox(8, nodes);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    static String summaryText(DungeonControlPanelView.OverlayControlsPanel.Settings settings) {
        return Levels.summaryText(settings);
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static final class FxAccess {

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

    private static final class Levels {

        private static String summaryText(DungeonControlPanelView.OverlayControlsPanel.Settings settings) {
            return switch (settings.mode()) {
                case OFF -> "Overlay: Aus";
                case NEARBY -> "Overlay: Nachbarn +/-" + settings.levelRange()
                        + " " + percentageText(settings.opacity());
                case SELECTED -> "Overlay: Auswahl z=" + levelsSummary(settings.selectedLevels())
                        + " " + percentageText(settings.opacity());
            };
        }

        private static String formatLevels(List<Integer> levels) {
            return (levels == null ? List.<Integer>of() : levels).stream()
                    .map(String::valueOf)
                    .sorted(Comparator.comparingInt(Integer::parseInt))
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
        }

        private static Optional<List<Integer>> parseLevels(String raw) {
            if (raw == null || raw.isBlank()) {
                return Optional.of(List.of());
            }
            try {
                return Optional.of(Arrays.stream(raw.split(","))
                        .map(String::trim)
                        .filter(part -> !part.isBlank())
                        .map(Integer::parseInt)
                        .sorted()
                        .distinct()
                        .toList());
            } catch (NumberFormatException exception) {
                return Optional.empty();
            }
        }

        private static String levelsSummary(List<Integer> levels) {
            String formatted = formatLevels(levels);
            return formatted.isBlank() ? "-" : formatted;
        }

        private static String percentageText(double opacity) {
            return Math.round(opacity * 100.0) + "%";
        }
    }
}
