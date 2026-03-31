package features.world.dungeonmap.state;

public sealed interface EditorDraft permits EditorDraft.BoundaryDraft {

    record BoundaryDraft(
            Long clusterId,
            String statusMessage
    ) implements EditorDraft {
        public BoundaryDraft {
            statusMessage = statusMessage == null ? "" : statusMessage;
        }
    }

}
