package features.encounter.model;

import features.partyanalysis.model.EncounterFunctionRole;
import features.partyanalysis.model.EncounterWeightClass;

/** A single creature type with a count within an {@link Encounter}. */
public class EncounterSlot {
    private final EncounterCreatureSnapshot creature;
    private int count;
    private EncounterWeightClass weightClass;
    private EncounterFunctionRole primaryFunctionRole;

    public EncounterSlot(
            EncounterCreatureSnapshot creature,
            int count,
            EncounterWeightClass weightClass,
            EncounterFunctionRole primaryFunctionRole) {
        if (creature == null) throw new IllegalArgumentException("creature must be non-null");
        if (count < 1) throw new IllegalArgumentException("count must be >= 1");
        this.creature = creature;
        this.count = count;
        this.weightClass = weightClass;
        this.primaryFunctionRole = primaryFunctionRole;
    }

    public EncounterSlot(EncounterSlot other) {
        this(other.creature, other.count, other.weightClass, other.primaryFunctionRole);
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

    public EncounterWeightClass getWeightClass() {
        return weightClass;
    }

    public void setWeightClass(EncounterWeightClass weightClass) {
        this.weightClass = weightClass;
    }

    public EncounterFunctionRole getPrimaryFunctionRole() {
        return primaryFunctionRole;
    }

    public void setPrimaryFunctionRole(EncounterFunctionRole primaryFunctionRole) {
        this.primaryFunctionRole = primaryFunctionRole;
    }
}
