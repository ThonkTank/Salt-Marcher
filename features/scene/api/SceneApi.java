package features.scene.api;

import java.util.concurrent.CompletionStage;

/** Non-blocking command boundary for the running-scene workspace. */
public interface SceneApi {

    CompletionStage<SceneMutationResult> execute(SceneCommand command);
}
