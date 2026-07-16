package features.encounter.api;

public record EncounterRuntimeNpcSpec(
        long worldNpcId,
        long statblockId,
        EncounterRuntimeNpcRole role
) {

    public EncounterRuntimeNpcSpec {
        worldNpcId = Math.max(0L, worldNpcId);
        statblockId = Math.max(0L, statblockId);
        role = role == null ? EncounterRuntimeNpcRole.NEUTRAL : role;
    }
}
