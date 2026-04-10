package clean.creatures.catalog.state;

/**
 * Owner-local runtime and persistence shapes for the clean creature catalog.
 */
@SuppressWarnings("unused")
public final class CatalogState {

    private CatalogState() {
        throw new AssertionError("No instances");
    }

    public record FilterOptionsState(
            java.util.List<String> sizes,
            java.util.List<String> types,
            java.util.List<String> subtypes,
            java.util.List<String> biomes,
            java.util.List<String> alignments
    ) {
    }

    public record CreatureSummaryState(
            long creatureId,
            String name,
            String cr,
            int xp,
            String size,
            String creatureType,
            String alignment
    ) {
    }

    public record SearchResultState(
            int totalCount,
            java.util.List<CreatureSummaryState> creatures
    ) {
    }

    public record CreatureActionState(
            String actionType,
            String name,
            String description,
            Integer toHitBonus
    ) {
    }

    public record CreatureDetailsState(
            long creatureId,
            String name,
            String size,
            String creatureType,
            java.util.List<String> subtypes,
            String alignment,
            String cr,
            int xp,
            int hp,
            String hitDice,
            Integer hitDiceCount,
            Integer hitDiceSides,
            Integer hitDiceModifier,
            int ac,
            String acNotes,
            int speed,
            int flySpeed,
            int swimSpeed,
            int climbSpeed,
            int burrowSpeed,
            int strength,
            int dexterity,
            int constitution,
            int intelligence,
            int wisdom,
            int charisma,
            int initiativeBonus,
            int proficiencyBonus,
            String savingThrows,
            String skills,
            String damageVulnerabilities,
            String damageResistances,
            String damageImmunities,
            String conditionImmunities,
            String senses,
            int passivePerception,
            String languages,
            int legendaryActionCount,
            java.util.List<String> biomes,
            java.util.List<CreatureActionState> traits,
            java.util.List<CreatureActionState> actions,
            java.util.List<CreatureActionState> bonusActions,
            java.util.List<CreatureActionState> reactions,
            java.util.List<CreatureActionState> legendaryActions
    ) {
    }

    public record EncounterCandidateState(
            long creatureId,
            String name,
            String creatureType,
            String cr,
            int xp,
            int hp,
            int ac,
            int initiativeBonus,
            int legendaryActionCount
    ) {
    }

    public record EncounterCandidatesState(
            java.util.List<EncounterCandidateState> creatures
    ) {
    }
}
