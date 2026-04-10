package clean.shell.scene.input;

import javafx.scene.Node;

public record ComposeSceneInput() {

    public record RegistrationInput(
            String label,
            Node initialContent
    ) {
    }

    public record HandleInput(
            java.util.function.Consumer<Node> setContent,
            Runnable activate
    ) {
    }

    public record RegistryInput(
            java.util.function.Function<RegistrationInput, HandleInput> registerScene
    ) {
    }

    public record SceneInput(
            Node stateContent,
            RegistryInput registry
    ) {
    }
}
