package src.view.dungeonshared.interactor;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.RadioMenuItem;
import javafx.scene.control.SeparatorMenuItem;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.SpinnerValueFactory;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.function.Consumer;

/**
 * Compact overlay trigger with an in-place menu for placeholder floor settings.
 */
public final class DungeonOverlayControls {

    private final MenuButton trigger = new MenuButton();
    private final ToggleGroup modeGroup = new ToggleGroup();
    private final RadioMenuItem offMode = modeItem(DungeonOverlayMode.OFF);
    private final RadioMenuItem nearbyMode = modeItem(DungeonOverlayMode.NEARBY);
    private final RadioMenuItem selectedMode = modeItem(DungeonOverlayMode.SELECTED);
    private final Spinner<Integer> rangeSpinner = new Spinner<>();
    private final Slider opacitySlider = new Slider(10.0, 90.0, 35.0);
    private final Label opacityLabel = new Label();
    private final TextField selectedLevelsField = new TextField();

    private Consumer<DungeonOverlayMode> onModeChanged = ignored -> { };
    private Consumer<Integer> onRangeChanged = ignored -> { };
    private Consumer<Double> onOpacityChanged = ignored -> { };
    private Consumer<List<Integer>> onSelectedLevelsChanged = ignored -> { };
    private boolean syncing;
    private DungeonOverlaySettings displayedSettings = DungeonOverlaySettings.defaults();

    public DungeonOverlayControls() {
        SpinnerValueFactory.IntegerSpinnerValueFactory rangeFactory =
                new SpinnerValueFactory.IntegerSpinnerValueFactory(1, 6, 1);
        rangeSpinner.setValueFactory(rangeFactory);
        rangeSpinner.setEditable(true);
        rangeSpinner.setPrefWidth(90.0);

        opacitySlider.setShowTickMarks(false);
        opacitySlider.setShowTickLabels(false);
        opacitySlider.setPrefWidth(160.0);
        HBox.setHgrow(opacitySlider, Priority.ALWAYS);
        opacityLabel.setMinWidth(Region.USE_PREF_SIZE);

        selectedLevelsField.setPromptText("-1, 1, 3");
        selectedLevelsField.setPrefColumnCount(10);

        trigger.getStyleClass().add("toolbar-action-button");
        trigger.getItems().setAll(
                offMode,
                nearbyMode,
                selectedMode,
                new SeparatorMenuItem(),
                menuItem(row("Umfang", rangeSpinner)),
                menuItem(row("Stärke", opacitySlider, opacityLabel)),
                menuItem(row("Ebenen", selectedLevelsField))
        );

        modeGroup.selectedToggleProperty().addListener((ignored, before, after) -> {
            if (syncing || !(after instanceof RadioMenuItem item)) {
                return;
            }
            DungeonOverlayMode mode = (DungeonOverlayMode) item.getUserData();
            onModeChanged.accept(mode);
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
        showSettings(DungeonOverlaySettings.defaults(), false);
    }

    public Node trigger() {
        return trigger;
    }

    public void setOnModeChanged(Consumer<DungeonOverlayMode> onModeChanged) {
        this.onModeChanged = onModeChanged == null ? ignored -> { } : onModeChanged;
    }

    public void setOnRangeChanged(Consumer<Integer> onRangeChanged) {
        this.onRangeChanged = onRangeChanged == null ? ignored -> { } : onRangeChanged;
    }

    public void setOnOpacityChanged(Consumer<Double> onOpacityChanged) {
        this.onOpacityChanged = onOpacityChanged == null ? ignored -> { } : onOpacityChanged;
    }

    public void setOnSelectedLevelsChanged(Consumer<List<Integer>> onSelectedLevelsChanged) {
        this.onSelectedLevelsChanged = onSelectedLevelsChanged == null ? ignored -> { } : onSelectedLevelsChanged;
    }

    public void showSettings(DungeonOverlaySettings settings, boolean disabled) {
        DungeonOverlaySettings resolved = settings == null ? DungeonOverlaySettings.defaults() : settings;
        syncing = true;
        displayedSettings = resolved;
        selectMode(resolved.mode());
        rangeSpinner.getValueFactory().setValue(resolved.levelRange());
        opacitySlider.setValue(resolved.opacity() * 100.0);
        selectedLevelsField.setText(formatLevels(resolved.selectedLevels()));
        updateOpacityLabel();
        updateEnabledState(resolved.mode(), disabled);
        trigger.setText(summaryText(resolved));
        trigger.setDisable(disabled);
        syncing = false;
    }

    private void commitSelectedLevels() {
        if (syncing) {
            return;
        }
        List<Integer> parsed = parseLevels(selectedLevelsField.getText());
        if (parsed == null) {
            selectedLevelsField.setText(formatLevels(displayedSettings.selectedLevels()));
            return;
        }
        selectedLevelsField.setText(formatLevels(parsed));
        onSelectedLevelsChanged.accept(parsed);
    }

    private RadioMenuItem modeItem(DungeonOverlayMode mode) {
        RadioMenuItem item = new RadioMenuItem(mode.label());
        item.setToggleGroup(modeGroup);
        item.setUserData(mode);
        return item;
    }

    private CustomMenuItem menuItem(Node content) {
        CustomMenuItem item = new CustomMenuItem(content, false);
        item.getStyleClass().add("dungeon-overlay-menu-item");
        return item;
    }

    private HBox row(String label, Region... content) {
        Label title = new Label(label);
        title.getStyleClass().add("text-muted");
        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getChildren().add(title);
        row.getChildren().addAll(content);
        return row;
    }

    private void selectMode(DungeonOverlayMode mode) {
        RadioMenuItem item = switch (mode) {
            case OFF -> offMode;
            case NEARBY -> nearbyMode;
            case SELECTED -> selectedMode;
        };
        item.setSelected(true);
    }

    private void updateEnabledState(DungeonOverlayMode mode, boolean disabled) {
        boolean showRange = mode.usesRange();
        boolean showSelected = mode.usesSelectedLevels();
        rangeSpinner.setDisable(disabled || !showRange);
        selectedLevelsField.setDisable(disabled || !showSelected);
        opacitySlider.setDisable(disabled);
    }

    private void updateOpacityLabel() {
        opacityLabel.setText(Math.round(opacitySlider.getValue()) + "%");
    }

    private static String summaryText(DungeonOverlaySettings settings) {
        return switch (settings.mode()) {
            case OFF -> "Overlay: Aus";
            case NEARBY -> "Overlay: Nachbarn ±" + settings.levelRange();
            case SELECTED -> "Overlay: z=" + formatLevels(settings.selectedLevels());
        };
    }

    private static String formatLevels(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }

    private static @Nullable List<Integer> parseLevels(String raw) {
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
