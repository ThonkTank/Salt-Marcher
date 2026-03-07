package features.encounter.model;

import features.gamerules.model.MonsterRole;

/** A single creature type with a count within an {@link Encounter}. {@code count} and {@code role} are mutable. */
public class EncounterSlot {
    private final EncounterCreatureSnapshot creature;
    private int count;
    private MonsterRole role;

    public EncounterSlot(EncounterCreatureSnapshot creature, int count, MonsterRole role) {
        if (creature == null) throw new IllegalArgumentException("creature must be non-null");
        if (count < 1) throw new IllegalArgumentException("count must be >= 1");
        if (role == null) throw new IllegalArgumentException("role must be non-null");
        this.creature = creature;
        this.count = count;
        this.role = role;
    }

    public EncounterSlot(EncounterSlot other) {
        this(other.creature, other.count, other.role);
    }

    public EncounterSlot copy() {
        return new EncounterSlot(this);
    }

    public EncounterCreatureSnapshot getCreature() {
        return creature;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        if (count < 1) throw new IllegalArgumentException("count must be >= 1");
        this.count = count;
    }

    public void incrementCount() {
        setCount(count + 1);
    }

    public void decrementCount() {
        setCount(count - 1);
    }

    public MonsterRole getRole() {
        return role;
    }

    public void setRole(MonsterRole role) {
        if (role == null) throw new IllegalArgumentException("role must be non-null");
        this.role = role;
    }
}
