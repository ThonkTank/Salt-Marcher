package features.scene.domain;

/** A nameless mob group in a scene: a catalog creature with a headcount. */
public record SceneMob(long creatureId, int count) {

    public SceneMob {
        if (creatureId <= 0L) {
            throw new IllegalArgumentException("creatureId must be positive");
        }
        if (count <= 0) {
            throw new IllegalArgumentException("count must be positive");
        }
    }

    public SceneMob withCount(int nextCount) {
        return new SceneMob(creatureId, nextCount);
    }
}
