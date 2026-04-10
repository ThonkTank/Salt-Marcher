package clean.frame;

import clean.frame.input.ComposeFrameInput;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

/**
 * Frame owner for the clean four-panel cockpit shell.
 */
@SuppressWarnings("unused")
public final class FrameObject {

    public ComposeFrameInput.FrameInput composeFrame(ComposeFrameInput input) {
        ComposeFrameInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        Label controlsLabel = new Label("Controls");
        VBox controlsPanel = new VBox(controlsLabel, resolvedInput.controlsContent());
        Label mainLabel = new Label("Main");
        VBox mainPanel = new VBox(mainLabel, resolvedInput.mainContent());
        VBox leftColumn = new VBox(controlsPanel, mainPanel);
        Label detailsLabel = new Label("Details");
        VBox detailsPanel = new VBox(detailsLabel, resolvedInput.detailsContent());
        Label stateLabel = new Label("State");
        VBox statePanel = new VBox(stateLabel, resolvedInput.stateContent());
        VBox rightColumn = new VBox(detailsPanel, statePanel);
        HBox contentRow = new HBox(resolvedInput.navigationContent(), leftColumn, rightColumn);
        VBox root = new VBox(resolvedInput.toolbarContent(), contentRow);
        return new ComposeFrameInput.FrameInput(root);
    }
}
