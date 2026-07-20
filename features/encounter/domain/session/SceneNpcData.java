package features.encounter.domain.session;

public record SceneNpcData(long worldNpcId, long creatureId, Role role) {

    public SceneNpcData {
        worldNpcId = Math.max(0L, worldNpcId);
        creatureId = Math.max(0L, creatureId);
        role = role == null ? Role.NEUTRAL : role;
    }

    public enum Role {
        HOSTILE,
        NEUTRAL,
        FRIENDLY
    }
}
