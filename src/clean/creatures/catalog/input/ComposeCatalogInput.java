package clean.creatures.catalog.input;

public record ComposeCatalogInput() {

    public record LoadFilterOptionsInput() {
    }

    public record LoadedFilterOptionsInput(
            boolean success,
            java.util.List<String> sizes,
            java.util.List<String> types,
            java.util.List<String> subtypes,
            java.util.List<String> biomes,
            java.util.List<String> alignments,
            java.util.List<String> crValues
    ) {
    }

    public record SearchCreaturesInput(
            CriteriaInput criteria,
            java.util.List<Long> excludeIds,
            java.util.List<Long> tableIds,
            PageInput page
    ) {
    }

    public record CriteriaInput(
            String nameQuery,
            String crMin,
            String crMax,
            java.util.List<String> sizes,
            java.util.List<String> types,
            java.util.List<String> subtypes,
            java.util.List<String> biomes,
            java.util.List<String> alignments
    ) {
    }

    public record PageInput(
            String sortColumn,
            String sortDirection,
            int limit,
            int offset
    ) {
    }

    public record CreatureSummaryInput(
            long creatureId,
            String name,
            String cr,
            int xp,
            String size,
            String creatureType,
            String alignment
    ) {
    }

    public record SearchedCreaturesInput(
            boolean success,
            boolean invalidCriteria,
            java.util.List<CreatureSummaryInput> creatures,
            int totalCount
    ) {
    }

    public record LoadCreatureInput(
            Long creatureId
    ) {
    }

    public record CreatureActionInput(
            String name,
            String description,
            Integer toHitBonus
    ) {
    }

    public record CreatureDetailsInput(
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
            java.util.List<CreatureActionInput> traits,
            java.util.List<CreatureActionInput> actions,
            java.util.List<CreatureActionInput> bonusActions,
            java.util.List<CreatureActionInput> reactions,
            java.util.List<CreatureActionInput> legendaryActions
    ) {
    }

    public record LoadedCreatureInput(
            boolean success,
            CreatureDetailsInput creature
    ) {
    }

    public record CatalogInput(
            java.util.function.Function<LoadFilterOptionsInput, LoadedFilterOptionsInput> loadFilterOptions,
            java.util.function.Function<SearchCreaturesInput, SearchedCreaturesInput> searchCreatures,
            java.util.function.Function<LoadCreatureInput, LoadedCreatureInput> loadCreature
    ) {
    }
}
