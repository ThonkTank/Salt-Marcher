package features.sessionplanner.application;

import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import java.util.Objects;

public record SessionPlannerWorkspaceAssembly(
        SessionPlannerWorkspaceSnapshot workspace,
        PreparedSceneCatalogSnapshot preparedScenes
) {
    public SessionPlannerWorkspaceAssembly {
        workspace = Objects.requireNonNull(workspace, "workspace");
        preparedScenes = Objects.requireNonNull(preparedScenes, "preparedScenes");
    }
}
