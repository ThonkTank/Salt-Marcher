package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public final class EncounterCandidate {

    private final CreatureCatalogLookup.EncounterCandidateProfile candidate;

    public EncounterCandidate(
            long id,
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
            int legendaryActionCount
    ) {
        this(new CreatureCatalogLookup.EncounterCandidateProfile(
                id,
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
                legendaryActionCount));
    }

    public EncounterCandidate(CreatureCatalogLookup.EncounterCandidateProfile candidate) {
        this.candidate = candidate == null
                ? new CreatureCatalogLookup.EncounterCandidateProfile(0L, "", "", "", 0, 0, null, null, null, 0, 0, 0)
                : candidate;
    }

    public static EncounterCandidate fromProfile(CreatureCatalogLookup.EncounterCandidateProfile candidate) {
        return new EncounterCandidate(candidate);
    }

    public long id() {
        return candidate.id();
    }

    public String name() {
        return candidate.name();
    }

    public String creatureType() {
        return candidate.creatureType();
    }

    public String challengeRating() {
        return candidate.challengeRating();
    }

    public int xp() {
        return candidate.xp();
    }

    public int hitPoints() {
        return candidate.hitPoints();
    }

    public @Nullable Integer hitDiceCount() {
        return candidate.hitDiceCount();
    }

    public @Nullable Integer hitDiceSides() {
        return candidate.hitDiceSides();
    }

    public @Nullable Integer hitDiceModifier() {
        return candidate.hitDiceModifier();
    }

    public int armorClass() {
        return candidate.armorClass();
    }

    public int initiativeBonus() {
        return candidate.initiativeBonus();
    }

    public int legendaryActionCount() {
        return candidate.legendaryActionCount();
    }
}
