package features.sessionplanner.api;

import java.util.List;

/** Immutable copies of every scene currently prepared in Session Planner. */
public record PreparedSceneCatalogSnapshot(
        long revision,
        List<PreparedSceneSource> scenes,
        String statusText
) {

    public PreparedSceneCatalogSnapshot {
        revision = Math.max(0L, revision);
        scenes = scenes == null ? List.of() : List.copyOf(scenes);
        statusText = statusText == null ? "" : statusText;
    }

    public static PreparedSceneCatalogSnapshot empty() {
        return new PreparedSceneCatalogSnapshot(0L, List.of(), "");
    }
}
