package src.view.leftbartabs.dungeoneditor;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.layout.HBox;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class DungeonEditorToolPalettePopup {

    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final Button primaryToolOption = createToolButton("");
    private final Button secondaryToolOption = createToolButton("");
    private final DungeonEditorControlsGate hiddenGate = new DungeonEditorControlsGate();
    private final DungeonEditorControlsEvents events;
    private final DungeonEditorToolControls toolControls;

    DungeonEditorToolPalettePopup(DungeonEditorControlsEvents events, DungeonEditorToolControls toolControls) {
        this.events = events;
        this.toolControls = toolControls;
        HBox panel = new HBox(8, primaryToolOption, secondaryToolOption);
        panel.setPadding(new Insets(10));
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form");
        popup.setContent(panel);
        popup.addOnHidden(event -> handleHidden());
    }

    void show(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        DungeonEditorContributionModel.ToolPaletteUiState resolvedState = toolPaletteUiState == null
                ? DungeonEditorContributionModel.ToolPaletteUiState.closed()
                : toolPaletteUiState;
        primaryToolOption.setText(resolvedState.primaryToolLabel());
        secondaryToolOption.setText(resolvedState.secondaryToolLabel());
        primaryToolOption.setOnAction(event -> events.toolSelected(resolvedState.primaryToolLabel()));
        secondaryToolOption.setOnAction(event -> events.toolSelected(resolvedState.secondaryToolLabel()));
        if (!resolvedState.visible()) {
            hidePopup();
            return;
        }
        Button anchor = toolControls.anchorFor(resolvedState.family());
        if (anchor == null) {
            hidePopup();
            return;
        }
        if (popup.isShowing()) {
            hidePopup();
        }
        popup.showBelow(anchor);
        popup.focusAfterShown(primaryToolOption);
    }

    private void handleHidden() {
        if (!hiddenGate.enabled()) {
            events.toolDismissed();
        }
    }

    private void hidePopup() {
        if (popup.isShowing()) {
            hiddenGate.runSuppressed(popup::hide);
        }
    }

    private static Button createToolButton(String text) {
        Button button = new Button(text);
        DungeonEditorControlsFxAccess.addStyle(button, "tool-btn");
        button.setMinWidth(javafx.scene.layout.Region.USE_PREF_SIZE);
        return button;
    }
}
