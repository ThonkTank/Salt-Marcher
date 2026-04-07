package features.world.dungeon.shell.editor.controls;

import features.world.dungeon.state.DungeonEditorTool;
import javafx.animation.PauseTransition;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.util.Duration;
import ui.components.AnchoredDropdown;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public final class ToolFamilyDropdownController {

    private final HBox optionRow = new HBox(8);
    private final ScrollPane dropdownPanel = new ScrollPane(optionRow);
    private final AnchoredDropdown dropdown;
    private final PauseTransition hideDelay = new PauseTransition(Duration.millis(120));
    private Node dropdownAnchor;
    private final List<Button> optionButtons = new ArrayList<>();

    public ToolFamilyDropdownController() {
        optionRow.getStyleClass().addAll("dropdown-window", "dropdown-form");
        optionRow.setPadding(new Insets(10));
        dropdownPanel.setContent(optionRow);
        dropdownPanel.setFitToHeight(true);
        dropdownPanel.setFitToWidth(true);
        dropdownPanel.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        dropdownPanel.setVbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        dropdownPanel.getStyleClass().add("transparent-scroll-pane");
        dropdown = new AnchoredDropdown(dropdownPanel);
        dropdown.setOnHidden(() -> dropdownAnchor = null);
        optionRow.setOnMouseEntered(event -> cancelHideCheck());
        optionRow.setOnMouseExited(event -> scheduleHideCheck());
        hideDelay.setOnFinished(event -> hideIfPointerLeftToolSurface());
    }

    public void bindAnchor(Button button) {
        button.setOnMouseEntered(event -> cancelHideCheck());
        button.setOnMouseExited(event -> scheduleHideCheck());
    }

    public void showFamilyOptions(
            Node anchor,
            ToolFamily family,
            DungeonEditorTool preferredTool,
            Consumer<DungeonEditorTool> onSelected
    ) {
        dropdownAnchor = anchor;
        List<Button> buttons = ensureOptionButtons(family.tools().size());
        for (int index = 0; index < buttons.size(); index++) {
            Button button = buttons.get(index);
            if (index < family.tools().size()) {
                configureOption(button, family.tools().get(index), onSelected);
                button.setManaged(true);
                button.setVisible(true);
            } else {
                button.setOnAction(null);
                button.setManaged(false);
                button.setVisible(false);
            }
        }
        dropdown.show(anchor);
        Button preferredButton = buttons.stream()
                .filter(button -> preferredTool != null && preferredTool.label().equals(button.getText()))
                .findFirst()
                .orElse(buttons.getFirst());
        dropdown.requestFocus(preferredButton);
    }

    private void configureOption(Button button, DungeonEditorTool tool, Consumer<DungeonEditorTool> onSelected) {
        button.setText(tool.label());
        button.setOnAction(event -> {
            if (onSelected != null) {
                onSelected.accept(tool);
            }
            dropdown.hide();
        });
    }

    private void scheduleHideCheck() {
        hideDelay.playFromStart();
    }

    private void cancelHideCheck() {
        hideDelay.stop();
    }

    private void hideIfPointerLeftToolSurface() {
        Platform.runLater(() -> {
            if (!dropdown.isShowing()) {
                return;
            }
            if (dropdownAnchor != null && dropdownAnchor.isHover()) {
                return;
            }
            if (optionRow.isHover()) {
                return;
            }
            dropdown.hide();
        });
    }

    private List<Button> ensureOptionButtons(int count) {
        while (optionButtons.size() < count) {
            Button button = new Button();
            button.getStyleClass().add("tool-btn");
            button.setMinWidth(Region.USE_PREF_SIZE);
            HBox.setHgrow(button, Priority.NEVER);
            optionButtons.add(button);
            optionRow.getChildren().add(button);
        }
        return List.copyOf(optionButtons);
    }
}
