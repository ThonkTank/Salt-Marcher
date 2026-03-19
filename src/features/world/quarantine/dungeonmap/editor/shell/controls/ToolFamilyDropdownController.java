package features.world.quarantine.dungeonmap.editor.shell.controls;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import javafx.animation.PauseTransition;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.layout.HBox;
import javafx.util.Duration;
import ui.components.AnchoredDropdown;

import java.util.function.Consumer;

public final class ToolFamilyDropdownController {

    private final Button primaryToolOption = new Button();
    private final Button secondaryToolOption = new Button();
    private final HBox dropdownPanel = new HBox(8, primaryToolOption, secondaryToolOption);
    private final AnchoredDropdown dropdown;
    private final PauseTransition hideDelay = new PauseTransition(Duration.millis(120));
    private Node dropdownAnchor;

    public ToolFamilyDropdownController() {
        dropdownPanel.getStyleClass().addAll("dropdown-window", "dropdown-form");
        dropdownPanel.setPadding(new Insets(10));
        dropdown = new AnchoredDropdown(dropdownPanel);
        dropdown.setOnHidden(() -> dropdownAnchor = null);
        dropdownPanel.setOnMouseEntered(event -> cancelHideCheck());
        dropdownPanel.setOnMouseExited(event -> scheduleHideCheck());
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
        configureOption(primaryToolOption, family.primaryTool(), onSelected);
        configureOption(secondaryToolOption, family.secondaryTool(), onSelected);
        dropdown.show(anchor);
        dropdown.requestFocus(preferredTool == family.secondaryTool() ? secondaryToolOption : primaryToolOption);
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
            if (dropdownPanel.isHover()) {
                return;
            }
            dropdown.hide();
        });
    }
}
