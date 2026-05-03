package src.view.slotcontent.controls.dungeoncontrol;

import java.util.Comparator;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
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
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public class DungeonControlPanelView extends VBox {

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
        row.getStyleClass().add("dungeon-control-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setMaxWidth(Double.MAX_VALUE);
        return row;
    }

    protected final HBox compactControlGroup(Node... controls) {
        HBox group = new HBox(0, controls);
        group.getStyleClass().add("dungeon-control-group");
        group.setAlignment(Pos.CENTER_LEFT);
        group.setMaxWidth(Region.USE_PREF_SIZE);
        return group;
    }

    protected final ScrollPane compactControlScroller(Node content) {
        ScrollPane scroller = new ScrollPane(content);
        scroller.getStyleClass().add("dungeon-control-scroll");
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
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    protected final Region spacer() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        return spacer;
    }

    public static final class OverlayControlsPanel {

        private final Button triggerButton = new Button();
        private final ComboBox<Mode> modeSelector = new ComboBox<>();
        private final Spinner<Integer> rangeSpinner = new Spinner<>();
        private final Slider opacitySlider = new Slider(10, 90, 35);
        private final Label opacityLabel = new Label();
        private final TextField selectedLevelsField = new TextField();
        private final HBox rangeRow;
        private final HBox selectedRow;
        private final AnchoredPopupView popup = new AnchoredPopupView();
        private Consumer<Mode> onModeChanged = ignored -> { };
        private Consumer<Integer> onRangeChanged = ignored -> { };
        private Consumer<Double> onOpacityChanged = ignored -> { };
        private Runnable onSelectedLevelsChanged = () -> { };
        private boolean syncing;
        private List<Integer> displayedSelectedLevels = List.of();

        public OverlayControlsPanel(Function<String, Label> sectionLabelFactory) {
            modeSelector.getItems().setAll(Mode.values());
            modeSelector.setConverter(new StringConverter<>() {
                @Override
                public String toString(Mode mode) {
                    return mode == null ? "" : mode.label();
                }

                @Override
                public @Nullable Mode fromString(String string) {
                    return null;
                }
            });
            modeSelector.setMaxWidth(Double.MAX_VALUE);
            HBox.setHgrow(modeSelector, Priority.ALWAYS);

            rangeSpinner.setValueFactory(new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 6, 2));
            rangeSpinner.setEditable(true);
            rangeSpinner.setPrefWidth(84);

            opacitySlider.setShowTickMarks(false);
            opacitySlider.setShowTickLabels(false);
            HBox.setHgrow(opacitySlider, Priority.ALWAYS);
            opacityLabel.setMinWidth(Region.USE_PREF_SIZE);

            selectedLevelsField.setPromptText("-1, 1, 3");
            selectedLevelsField.setPrefColumnCount(10);
            HBox.setHgrow(selectedLevelsField, Priority.ALWAYS);

            triggerButton.getStyleClass().addAll("toolbar-action-button", "dungeon-overlay-trigger");
            triggerButton.setMinWidth(Region.USE_PREF_SIZE);
            triggerButton.setOnAction(event -> togglePopup());

            HBox modeRow = row(new Label("Modus"), modeSelector);
            rangeRow = row(new Label("Umfang"), rangeSpinner);
            HBox opacityRow = row(new Label("Staerke"), opacitySlider, opacityLabel);
            selectedRow = row(new Label("Ebenen"), selectedLevelsField);
            VBox content = new VBox(6, sectionLabelFactory.apply("Overlay"), modeRow, opacityRow, rangeRow, selectedRow);
            content.setPadding(new Insets(8));
            content.getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown");
            popup.setContent(content);

            modeSelector.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
                if (syncing || after == null) {
                    return;
                }
                updateEnabledState(after, triggerButton.isDisabled());
                onModeChanged.accept(after);
            });
            rangeSpinner.valueProperty().addListener((ignored, before, after) -> {
                if (!syncing && after != null) {
                    onRangeChanged.accept(after);
                }
            });
            opacitySlider.valueProperty().addListener((ignored, before, after) -> {
                updateOpacityLabel();
                if (!syncing && after != null) {
                    onOpacityChanged.accept(after.doubleValue() / 100.0);
                }
            });
            selectedLevelsField.setOnAction(event -> commitSelectedLevels());
            selectedLevelsField.focusedProperty().addListener((ignored, before, focused) -> {
                if (!focused) {
                    commitSelectedLevels();
                }
            });
            showSettings(Settings.defaults(), false);
        }

        public Node trigger() {
            return triggerButton;
        }

        public void setOnModeChanged(Consumer<Mode> action) {
            onModeChanged = action == null ? ignored -> { } : action;
        }

        public void setOnRangeChanged(Consumer<Integer> action) {
            onRangeChanged = action == null ? ignored -> { } : action;
        }

        public void setOnOpacityChanged(Consumer<Double> action) {
            onOpacityChanged = action == null ? ignored -> { } : action;
        }

        public void setOnSelectedLevelsChanged(Runnable action) {
            onSelectedLevelsChanged = action == null ? () -> { } : action;
        }

        public void showSettings(Settings settings, boolean disabled) {
            Settings resolved = settings == null ? Settings.defaults() : settings;
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

        public String overlayModeKey() {
            Mode selectedMode = modeSelector.getSelectionModel().getSelectedItem();
            return selectedMode == null ? "" : selectedMode.name();
        }

        public int overlayRange() {
            Integer value = rangeSpinner.getValue();
            return value == null ? 0 : value;
        }

        public double overlayOpacity() {
            return opacitySlider.getValue() / 100.0;
        }

        public String overlayLevelsText() {
            return selectedLevelsField.getText() == null ? "" : selectedLevelsField.getText().strip();
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
            onSelectedLevelsChanged.run();
        }

        private void updateEnabledState(Mode mode, boolean globalDisabled) {
            Mode resolvedMode = mode == null ? Mode.OFF : mode;
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

        private void togglePopup() {
            if (triggerButton.isDisabled()) {
                return;
            }
            if (popup.isShowing()) {
                popup.hide();
                return;
            }
            popup.showBelow(triggerButton);
            popup.focusAfterShown(modeSelector);
        }

        private static HBox row(Region... nodes) {
            HBox row = new HBox(8, nodes);
            row.setAlignment(Pos.CENTER_LEFT);
            row.setMaxWidth(Double.MAX_VALUE);
            return row;
        }

        private static String summaryText(Settings settings) {
            return switch (settings.mode()) {
                case OFF -> "Overlay: Aus";
                case NEARBY -> "Overlay: Nachbarn +/-" + settings.levelRange()
                        + " " + percentageText(settings.opacity());
                case SELECTED -> "Overlay: Auswahl z=" + levelsSummary(settings.selectedLevels())
                        + " " + percentageText(settings.opacity());
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
                    .sorted(Comparator.comparingInt(Integer::parseInt))
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
        }

        private static @Nullable List<Integer> parseLevels(@Nullable String raw) {
            if (raw == null || raw.isBlank()) {
                return List.of();
            }
            try {
                return java.util.Arrays.stream(raw.split(","))
                        .map(String::trim)
                        .filter(part -> !part.isBlank())
                        .map(Integer::parseInt)
                        .sorted()
                        .distinct()
                        .toList();
            } catch (NumberFormatException exception) {
                return null;
            }
        }

        public enum Mode {
            OFF("Aus"),
            NEARBY("Nahe Ebenen"),
            SELECTED("Auswahl");

            private final String label;

            Mode(String label) {
                this.label = label;
            }

            String label() {
                return label;
            }

            boolean usesRange() {
                return this == NEARBY;
            }

            boolean usesSelectedLevels() {
                return this == SELECTED;
            }
        }

        public record Settings(
                Mode mode,
                int levelRange,
                double opacity,
                List<Integer> selectedLevels
        ) {

            public Settings {
                mode = mode == null ? Mode.OFF : mode;
                levelRange = Math.max(1, levelRange);
                opacity = Math.max(0.1, Math.min(0.9, opacity));
                selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
            }

            static Settings defaults() {
                return new Settings(Mode.OFF, 2, 0.35, List.of());
            }
        }
    }
}
