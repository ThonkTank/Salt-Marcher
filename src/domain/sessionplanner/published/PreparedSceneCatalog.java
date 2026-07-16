package src.domain.sessionplanner.published;

import java.util.List;

/** Read-only runtime import choices owned by Session Planner. */
public record PreparedSceneCatalog(List<PreparedScene> scenes, String statusText) {
    public PreparedSceneCatalog {
        scenes = scenes == null ? List.of() : List.copyOf(scenes);
        statusText = statusText == null ? "" : statusText;
    }

    public record PreparedScene(
            long sessionId,
            String sessionName,
            long sceneId,
            String title,
            String notes,
            long locationId,
            long encounterPlanId,
            List<Long> participantIds
    ) {
        public PreparedScene {
            sessionName = sessionName == null ? "" : sessionName;
            title = title == null ? "" : title;
            notes = notes == null ? "" : notes;
            participantIds = participantIds == null ? List.of() : List.copyOf(participantIds);
        }
    }
}
