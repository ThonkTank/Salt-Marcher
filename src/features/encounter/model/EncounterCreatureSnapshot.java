package features.encounter.model;

/** Encounter-owned creature projection used by encounter/combat models. */
public class EncounterCreatureSnapshot {
    private final Long id;
    private final String name;
    private final int xp;
    private final int hp;
    private final int ac;
    private final int initiativeBonus;
    private final String crDisplay;
    private final String creatureType;

    public EncounterCreatureSnapshot(
            Long id,
            String name,
            int xp,
            int hp,
            int ac,
            int initiativeBonus,
            String crDisplay,
            String creatureType) {
        if (id == null) throw new IllegalArgumentException("id must be non-null");
        if (name == null || name.isBlank()) throw new IllegalArgumentException("name must be non-blank");
        this.id = id;
        this.name = name;
        this.xp = xp;
        this.hp = hp;
        this.ac = ac;
        this.initiativeBonus = initiativeBonus;
        this.crDisplay = crDisplay == null || crDisplay.isBlank() ? "0" : crDisplay;
        this.creatureType = creatureType;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getXp() {
        return xp;
    }

    public int getHp() {
        return hp;
    }

    public int getAc() {
        return ac;
    }

    public int getInitiativeBonus() {
        return initiativeBonus;
    }

    public String getCrDisplay() {
        return crDisplay;
    }

    public String getCreatureType() {
        return creatureType;
    }
}
