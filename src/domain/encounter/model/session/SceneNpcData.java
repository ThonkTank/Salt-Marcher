package src.domain.encounter.model.session;

public record SceneNpcData(long worldNpcId, long creatureId, Role role, boolean active) {
    public SceneNpcData { role = role == null ? Role.NEUTRAL : role; }
    public enum Role { HOSTILE, NEUTRAL, FRIENDLY }
}
