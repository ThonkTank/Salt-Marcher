package features.scene.application;

import features.scene.domain.SceneWorkspace;
import java.util.Optional;

public interface SceneWorkspaceRepository {

    Optional<SceneWorkspace> load();

    void save(SceneWorkspace workspace);
}
