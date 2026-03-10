package features.encounter.model;

import features.creatures.model.Creature;
import features.creatures.model.HitDice;

/** Maps creaturecatalog entities to encounter-owned snapshots. */
public final class EncounterCreatureSnapshotMapper {
    private EncounterCreatureSnapshotMapper() {
        throw new AssertionError("No instances");
    }

    public static EncounterCreatureSnapshot toSnapshot(Creature creature) {
        if (creature == null) {
            throw new IllegalArgumentException("creature must be non-null");
        }
        if (creature.Id == null) {
            throw new IllegalArgumentException("creature.Id must be non-null");
        }
        return new EncounterCreatureSnapshot(
                creature.Id,
                creature.Name,
                creature.XP,
                creature.HP,
                HitDice.fromParts(
                        creature.HitDiceCount,
                        creature.HitDiceSides,
                        creature.HitDiceModifier).orElse(null),
                creature.AC,
                creature.InitiativeBonus,
                creature.CR != null ? creature.CR.display : "0",
                creature.CreatureType
        );
    }
}
