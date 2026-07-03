package src.domain.encounter.model.session;

public record CombatCardData(
        String id,
        String name,
        boolean playerCharacter,
        long worldNpcId,
        boolean active,
        boolean alive,
        int currentHp,
        int maxHp,
        int armorClass,
        int initiative,
        int count,
        String detail
) {
    public CombatCardData {
        id = id == null ? "" : id;
        name = name == null ? "" : name;
        worldNpcId = Math.max(0L, worldNpcId);
        detail = detail == null ? "" : detail;
    }
}
