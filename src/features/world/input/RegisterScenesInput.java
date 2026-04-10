package features.world.input;

import java.util.Objects;

@SuppressWarnings("unused")
public record RegisterScenesInput(ui.shell.SceneRegistry sceneRegistry) {

    public RegisterScenesInput {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
    }
}
