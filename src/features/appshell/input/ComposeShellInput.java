package features.appshell.input;

import javafx.scene.Node;
import javafx.scene.layout.BorderPane;

@SuppressWarnings("unused")
public record ComposeShellInput(
        String title,
        String navigationLabel,
        Node controlsContent,
        Node mainContent,
        Node detailsContent,
        Node stateContent
) {

    public record ShellInput(
            BorderPane root
    ) {
    }
}
