package src.domain.encounter.model.session;

public record ResultEnemyData(
        String name,
        long creatureId,
        long worldNpcId,
        String status,
        int hpLoss,
        int xp,
        boolean defeatedByDefault,
        String loot
) {
    public ResultEnemyData {
        name = name == null ? "" : name;
        creatureId = Math.max(0L, creatureId);
        worldNpcId = Math.max(0L, worldNpcId);
        status = status == null ? "" : status;
        loot = loot == null ? "" : loot;
    }
}
