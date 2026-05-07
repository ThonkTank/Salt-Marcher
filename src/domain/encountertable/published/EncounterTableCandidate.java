package src.domain.encountertable.published;

import org.jspecify.annotations.Nullable;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;

public final class EncounterTableCandidate {

    private final EncounterTableCandidateData data;

    public EncounterTableCandidate(
            long creatureId,
            String name,
            String creatureType,
            String challengeRating,
            int xp,
            int hitPoints,
            @Nullable Integer hitDiceCount,
            @Nullable Integer hitDiceSides,
            @Nullable Integer hitDiceModifier,
            int armorClass,
            int initiativeBonus,
            int legendaryActionCount,
            int weight
    ) {
        this(new EncounterTableCandidateData(
                creatureId,
                name,
                creatureType,
                challengeRating,
                xp,
                hitPoints,
                hitDiceCount,
                hitDiceSides,
                hitDiceModifier,
                armorClass,
                initiativeBonus,
                legendaryActionCount,
                weight));
    }

    public EncounterTableCandidate(EncounterTableCandidateData data) {
        this.data = data == null
                ? new EncounterTableCandidateData(0L, "", "", "", 0, 0, null, null, null, 0, 0, 0, 1)
                : data;
    }

    public static EncounterTableCandidate fromData(EncounterTableCandidateData data) {
        return new EncounterTableCandidate(data);
    }

    public long creatureId() {
        return data.creatureId();
    }

    public String name() {
        return data.name();
    }

    public String creatureType() {
        return data.creatureType();
    }

    public String challengeRating() {
        return data.challengeRating();
    }

    public int xp() {
        return data.xp();
    }

    public int hitPoints() {
        return data.hitPoints();
    }

    public @Nullable Integer hitDiceCount() {
        return data.hitDiceCount();
    }

    public @Nullable Integer hitDiceSides() {
        return data.hitDiceSides();
    }

    public @Nullable Integer hitDiceModifier() {
        return data.hitDiceModifier();
    }

    public int armorClass() {
        return data.armorClass();
    }

    public int initiativeBonus() {
        return data.initiativeBonus();
    }

    public int legendaryActionCount() {
        return data.legendaryActionCount();
    }

    public int weight() {
        return data.weight();
    }
}
