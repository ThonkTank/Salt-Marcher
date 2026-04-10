package clean.shell.frame.input;

import javafx.scene.Node;
import javafx.scene.layout.BorderPane;

public record ComposeFrameInput(
        Node toolbarContent,
        Node navigationContent,
        Node controlsContent,
        Node mainContent,
        Node detailsContent,
        Node stateContent
) {

    public record FrameInput(
            BorderPane root
    ) {
    }
}
