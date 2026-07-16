package features.worldplanner.api;

public record SetWorldNpcLifecycleStatusCommand(
        long npcId,
        WorldNpcLifecycleStatus status,
        long expectedCreatureStatblockId
) {
    public static SetWorldNpcLifecycleStatusCommand defeated(long npcId) {
        return new SetWorldNpcLifecycleStatusCommand(npcId, WorldNpcLifecycleStatus.DEFEATED, 0L);
    }

    public static SetWorldNpcLifecycleStatusCommand defeated(long npcId, long expectedCreatureStatblockId) {
        return new SetWorldNpcLifecycleStatusCommand(
                npcId,
                WorldNpcLifecycleStatus.DEFEATED,
                expectedCreatureStatblockId);
    }

    public static SetWorldNpcLifecycleStatusCommand active(long npcId) {
        return new SetWorldNpcLifecycleStatusCommand(npcId, WorldNpcLifecycleStatus.ACTIVE, 0L);
    }

    public SetWorldNpcLifecycleStatusCommand {
        npcId = Math.max(0L, npcId);
        expectedCreatureStatblockId = Math.max(0L, expectedCreatureStatblockId);
    }

}
