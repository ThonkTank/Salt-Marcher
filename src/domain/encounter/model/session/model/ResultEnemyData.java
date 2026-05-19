package src.domain.encounter.model.session.model;

public record ResultEnemyData(
        String name,
        String status,
        int hpLoss,
        int xp,
        boolean defeatedByDefault,
        String loot
) {
    public ResultEnemyData {
        name = name == null ? "" : name;
        status = status == null ? "" : status;
        loot = loot == null ? "" : loot;
    }
}
