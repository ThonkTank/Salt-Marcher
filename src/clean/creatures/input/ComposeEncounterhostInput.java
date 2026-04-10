package clean.creatures.input;

import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeEncounterhostInput() {

    public record EncounterhostInput(
            Node controlsContent,
            Node mainContent,
            java.util.function.Consumer<ComposeShellInput.ShellHooksInput> onShellReady
    ) {
    }
}
