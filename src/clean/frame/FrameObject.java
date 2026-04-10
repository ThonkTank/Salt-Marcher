package clean.frame;

import clean.frame.input.ComposeFrameInput;
import javafx.scene.layout.BorderPane;

/**
 * Frame owner for the clean four-panel cockpit shell.
 */
@SuppressWarnings("unused")
public final class FrameObject {

    public ComposeFrameInput.FrameInput composeFrame(ComposeFrameInput input) {
        java.util.Objects.requireNonNull(input, "input");
        BorderPane root = new BorderPane();
        return new ComposeFrameInput.FrameInput(root);
    }
}
