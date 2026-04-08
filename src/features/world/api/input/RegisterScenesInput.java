package features.world.api.input;

import java.util.Objects;

public record RegisterScenesInput(ui.shell.SceneRegistry sceneRegistry) {

    public RegisterScenesInput {
        Objects.requireNonNull(sceneRegistry, "sceneRegistry");
    }
}
