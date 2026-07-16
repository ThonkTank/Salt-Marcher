package src.domain.scene.model.repository;

import java.util.Optional;
import src.domain.scene.model.SceneWorkspace;

public interface SceneWorkspaceRepository {
    Optional<SceneWorkspace> load();
    SceneWorkspace save(SceneWorkspace workspace);
}
