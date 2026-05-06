package src.view.slotcontent.controls.dungeoncontrol;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Control;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
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

    public static final class OverlayControlsPanel {

        private final Button triggerButton = new Button();
        private final OverlayPopupContentView popupContent;
        private final AnchoredPopupView popup = new AnchoredPopupView();
        private Consumer<InputSnapshot> onChanged = ignored -> { };

        public OverlayControlsPanel(Function<String, Label> sectionLabelFactory) {
            popupContent = new OverlayPopupContentView(sectionLabelFactory, this::publishChange);
            popup.setContent(popupContent);
            FxAccess.addStyles(triggerButton, "toolbar-action-button", "dungeon-overlay-trigger");
            triggerButton.setMinWidth(USE_PREF_SIZE);
            triggerButton.setOnAction(event -> togglePopup());
            showSettings(Settings.defaults(), false);
        }

        public Node trigger() {
            return triggerButton;
        }

        public void onChanged(Consumer<InputSnapshot> action) {
            onChanged = action == null ? ignored -> { } : action;
        }

        public void showSettings(Settings settings, boolean disabled) {
            Settings resolved = settings == null ? Settings.defaults() : settings;
            popupContent.showSettings(resolved, disabled);
            triggerButton.setText(OverlayPopupContentView.summaryText(resolved));
            triggerButton.setDisable(disabled);
        }

        public InputSnapshot snapshot() {
            return popupContent.snapshot();
        }

        public record InputSnapshot(
                String modeKey,
                int range,
                double opacity,
                String levelsText
        ) {

            public InputSnapshot {
                modeKey = modeKey == null ? "" : modeKey;
                range = Math.max(0, range);
                opacity = Math.max(0.0, Math.min(1.0, opacity));
                levelsText = levelsText == null ? "" : levelsText.strip();
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

            static Mode defaultMode() {
                return OFF;
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

        private void publishChange() {
            onChanged.accept(snapshot());
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
            popup.focusAfterShown(popupContent.focusTarget());
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
    }
}
