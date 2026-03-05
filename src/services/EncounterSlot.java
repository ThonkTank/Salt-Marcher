package services;

import entities.Creature;
import services.RoleClassifier.MonsterRole;

/** A single creature type with a count within an {@link Encounter}. {@code count} and {@code role} are mutable. */
public class EncounterSlot {
    public final Creature creature;
    public int count;
    public MonsterRole role;

    public EncounterSlot(Creature creature, int count, MonsterRole role) {
        if (creature == null) throw new IllegalArgumentException("creature must be non-null");
        this.creature = creature;
        this.count = count;
        this.role = role;
    }
}
