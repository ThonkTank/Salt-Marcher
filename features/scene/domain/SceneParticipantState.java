package features.scene.domain;

/** Per-scene live state for one participant: defeated flag and a quick note. */
public record SceneParticipantState(
        SceneParticipantKind kind,
        long refId,
        boolean defeated,
        String notes
) {

    public SceneParticipantState {
        if (kind == null) {
            throw new IllegalArgumentException("kind is required");
        }
        if (refId <= 0L) {
            throw new IllegalArgumentException("refId must be positive");
        }
        notes = notes == null ? "" : notes.trim();
    }

    public boolean addressesSameParticipant(SceneParticipantKind otherKind, long otherRefId) {
        return kind == otherKind && refId == otherRefId;
    }
}
