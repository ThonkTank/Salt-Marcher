package src.domain.encounter.model.generation;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record EncounterCreatureFacts(
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
        int legendaryActionCount,
        int flySpeed,
        int swimSpeed,
        int climbSpeed,
        int burrowSpeed,
        @Nullable String damageResistances,
        @Nullable String damageImmunities,
        @Nullable String conditionImmunities,
        int passivePerception,
        List<ActionFacts> actions
) {

    public EncounterCreatureFacts {
        name = name == null ? "" : name;
        creatureType = creatureType == null ? "" : creatureType;
        challengeRating = challengeRating == null ? "" : challengeRating;
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    public record ActionFacts(
            String actionType
    ) {
        public ActionFacts {
            actionType = actionType == null ? "" : actionType;
        }
    }
}
