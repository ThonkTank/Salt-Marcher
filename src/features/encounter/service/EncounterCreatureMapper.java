package features.encounter.service;

import features.creaturecatalog.model.Creature;
import features.encounter.model.EncounterCreatureSnapshot;

/** Maps creaturecatalog entities to encounter-owned snapshots. */
public final class EncounterCreatureMapper {
    private EncounterCreatureMapper() {
        throw new AssertionError("No instances");
    }

    public static EncounterCreatureSnapshot toSnapshot(Creature creature) {
        if (creature == null) throw new IllegalArgumentException("creature must be non-null");
        if (creature.Id == null) throw new IllegalArgumentException("creature.Id must be non-null");
        return new EncounterCreatureSnapshot(
                creature.Id,
                creature.Name,
                creature.XP,
                creature.HP,
                creature.AC,
                creature.InitiativeBonus,
                creature.CR != null ? creature.CR.display : "0",
                creature.CreatureType
        );
    }
}
