package features.creatures.domain.catalog;

import java.util.List;
import org.jspecify.annotations.Nullable;

public final class CreatureCatalogData {

    private CreatureCatalogData() {
    }

    public static DistinctFilterValues emptyFilterValues() {
        return new DistinctFilterValues(List.of(), List.of(), List.of(), List.of(), List.of());
    }

    public static CatalogPageData emptyCatalogPage(int pageSize, int pageOffset) {
        return new CatalogPageData(List.of(), 0, pageSize, pageOffset);
    }

    public record DistinctFilterValues(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        public DistinctFilterValues {
            sizes = copyStrings(sizes);
            types = copyStrings(types);
            subtypes = copyStrings(subtypes);
            biomes = copyStrings(biomes);
            alignments = copyStrings(alignments);
        }

        @Override
        public List<String> alignments() {
            return copyStrings(alignments);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }

        @Override
        public List<String> sizes() {
            return copyStrings(sizes);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> types() {
            return copyStrings(types);
        }
    }

    public enum CatalogSortField {
        NAME,
        CHALLENGE_RATING,
        XP;

        public static CatalogSortField fromName(@Nullable String sortFieldName) {
            if (sortFieldName == null) {
                return NAME;
            }
            return switch (sortFieldName) {
                case "CHALLENGE_RATING" -> CHALLENGE_RATING;
                case "XP" -> XP;
                default -> NAME;
            };
        }
    }

    public record CatalogSearchSpec(
            @Nullable String nameQuery,
            @Nullable Integer minimumXp,
            @Nullable Integer maximumXp,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            String sortField,
            boolean sortAscending,
            int pageSize,
            int pageOffset
    ) {
        public CatalogSearchSpec {
            sizes = copyStrings(sizes);
            types = copyStrings(types);
            subtypes = copyStrings(subtypes);
            biomes = copyStrings(biomes);
            alignments = copyStrings(alignments);
        }

        @Override
        public List<String> sizes() {
            return copyStrings(sizes);
        }

        @Override
        public List<String> types() {
            return copyStrings(types);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }

        @Override
        public List<String> alignments() {
            return copyStrings(alignments);
        }

        public CatalogSortField sortFieldType() {
            return CatalogSortField.fromName(sortField);
        }
    }

    public record EncounterCandidateSpec(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        public EncounterCandidateSpec {
            types = copyStrings(types);
            subtypes = copyStrings(subtypes);
            biomes = copyStrings(biomes);
        }

        @Override
        public List<String> types() {
            return copyStrings(types);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }
    }

    public record CreatureIdentity(
            long id,
            String name,
            String size,
            String creatureType,
            List<String> subtypes,
            List<String> biomes,
            String alignment,
            String challengeRating,
            int xp
    ) {
        public CreatureIdentity {
            subtypes = copyStrings(subtypes);
            biomes = copyStrings(biomes);
        }

        @Override
        public List<String> subtypes() {
            return copyStrings(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyStrings(biomes);
        }
    }

    public record CreatureVitals(
            int hitPoints,
            @Nullable String hitDiceExpression,
            @Nullable Integer hitDiceCount,
            @Nullable Integer hitDiceSides,
            @Nullable Integer hitDiceModifier,
            int armorClass,
            @Nullable String armorClassNotes,
            int walkSpeed,
            int flySpeed,
            int swimSpeed,
            int climbSpeed,
            int burrowSpeed
    ) {
    }

    public record CreatureAbilities(
            int strength,
            int dexterity,
            int constitution,
            int intelligence,
            int wisdom,
            int charisma,
            int initiativeBonus,
            int proficiencyBonus
    ) {
    }

    public record CreatureTraits(
            @Nullable String savingThrows,
            @Nullable String skills,
            @Nullable String damageVulnerabilities,
            @Nullable String damageResistances,
            @Nullable String damageImmunities,
            @Nullable String conditionImmunities,
            @Nullable String senses,
            int passivePerception,
            @Nullable String languages,
            int legendaryActionCount
    ) {
    }

    public static final class CreatureActionData {
        private final String actionType;
        private final String name;
        private final String description;
        private final @Nullable Integer toHitBonus;

        public CreatureActionData(
                String actionType,
                String name,
                String description,
                @Nullable Integer toHitBonus
        ) {
            this.actionType = actionType == null ? "" : actionType;
            this.name = name == null ? "" : name;
            this.description = description == null ? "" : description;
            this.toHitBonus = toHitBonus;
        }

        public String actionType() {
            return actionType;
        }

        public String name() {
            return name;
        }

        public String description() {
            return description;
        }

        public @Nullable Integer toHitBonus() {
            return toHitBonus;
        }
    }

    public record CreatureProfile(
            CreatureIdentity identity,
            CreatureVitals vitals,
            CreatureAbilities abilities,
            CreatureTraits traits,
            List<CreatureActionData> actions
    ) {
        public CreatureProfile {
            identity = identity == null
                    ? new CreatureIdentity(0, "", "", "", List.of(), List.of(), "", "", 0)
                    : identity;
            vitals = vitals == null
                    ? new CreatureVitals(0, null, null, null, null, 0, null, 0, 0, 0, 0, 0)
                    : vitals;
            abilities = abilities == null
                    ? new CreatureAbilities(0, 0, 0, 0, 0, 0, 0, 0)
                    : abilities;
            traits = traits == null
                    ? new CreatureTraits(null, null, null, null, null, null, null, 0, null, 0)
                    : traits;
            actions = actions == null ? List.of() : List.copyOf(actions);
        }

        public long id() {
            return identity.id();
        }

        public String name() {
            return identity.name();
        }

        public String size() {
            return identity.size();
        }

        public String creatureType() {
            return identity.creatureType();
        }

        public List<String> subtypes() {
            return identity.subtypes();
        }

        public List<String> biomes() {
            return identity.biomes();
        }

        public String alignment() {
            return identity.alignment();
        }

        public String challengeRating() {
            return identity.challengeRating();
        }

        public int xp() {
            return identity.xp();
        }

        public int hitPoints() {
            return vitals.hitPoints();
        }

        public @Nullable String hitDiceExpression() {
            return vitals.hitDiceExpression();
        }

        public @Nullable Integer hitDiceCount() {
            return vitals.hitDiceCount();
        }

        public @Nullable Integer hitDiceSides() {
            return vitals.hitDiceSides();
        }

        public @Nullable Integer hitDiceModifier() {
            return vitals.hitDiceModifier();
        }

        public int armorClass() {
            return vitals.armorClass();
        }

        public @Nullable String armorClassNotes() {
            return vitals.armorClassNotes();
        }

        public int walkSpeed() {
            return vitals.walkSpeed();
        }

        public int flySpeed() {
            return vitals.flySpeed();
        }

        public int swimSpeed() {
            return vitals.swimSpeed();
        }

        public int climbSpeed() {
            return vitals.climbSpeed();
        }

        public int burrowSpeed() {
            return vitals.burrowSpeed();
        }

        public int strength() {
            return abilities.strength();
        }

        public int dexterity() {
            return abilities.dexterity();
        }

        public int constitution() {
            return abilities.constitution();
        }

        public int intelligence() {
            return abilities.intelligence();
        }

        public int wisdom() {
            return abilities.wisdom();
        }

        public int charisma() {
            return abilities.charisma();
        }

        public int initiativeBonus() {
            return abilities.initiativeBonus();
        }

        public int proficiencyBonus() {
            return abilities.proficiencyBonus();
        }

        public @Nullable String savingThrows() {
            return traits.savingThrows();
        }

        public @Nullable String skills() {
            return traits.skills();
        }

        public @Nullable String damageVulnerabilities() {
            return traits.damageVulnerabilities();
        }

        public @Nullable String damageResistances() {
            return traits.damageResistances();
        }

        public @Nullable String damageImmunities() {
            return traits.damageImmunities();
        }

        public @Nullable String conditionImmunities() {
            return traits.conditionImmunities();
        }

        public @Nullable String senses() {
            return traits.senses();
        }

        public int passivePerception() {
            return traits.passivePerception();
        }

        public @Nullable String languages() {
            return traits.languages();
        }

        public int legendaryActionCount() {
            return traits.legendaryActionCount();
        }
    }

    public static final class CatalogPageData {
        private final List<CatalogRowData> rows;
        private final int totalCount;
        private final int pageSize;
        private final int pageOffset;

        public CatalogPageData(List<CatalogRowData> rows, int totalCount, int pageSize, int pageOffset) {
            this.rows = rows == null ? List.of() : List.copyOf(rows);
            this.totalCount = Math.max(0, totalCount);
            this.pageSize = Math.max(0, pageSize);
            this.pageOffset = Math.max(0, pageOffset);
        }

        public List<CatalogRowData> rows() {
            return List.copyOf(rows);
        }

        public int totalCount() {
            return totalCount;
        }

        public int pageSize() {
            return pageSize;
        }

        public int pageOffset() {
            return pageOffset;
        }
    }

    public static final class CatalogRowData {
        private final long id;
        private final String name;
        private final String size;
        private final String creatureType;
        private final String alignment;
        private final String challengeRating;
        private final int xp;
        private final int hitPoints;
        private final int armorClass;

        public CatalogRowData(
                long id,
                String name,
                String size,
                String creatureType,
                String alignment,
                String challengeRating,
                int xp,
                int hitPoints,
                int armorClass
        ) {
            this.id = id;
            this.name = name == null ? "" : name;
            this.size = size == null ? "" : size;
            this.creatureType = creatureType == null ? "" : creatureType;
            this.alignment = alignment == null ? "" : alignment;
            this.challengeRating = challengeRating == null ? "" : challengeRating;
            this.xp = xp;
            this.hitPoints = hitPoints;
            this.armorClass = armorClass;
        }

        public long id() {
            return id;
        }

        public String name() {
            return name;
        }

        public String size() {
            return size;
        }

        public String creatureType() {
            return creatureType;
        }

        public String alignment() {
            return alignment;
        }

        public String challengeRating() {
            return challengeRating;
        }

        public int xp() {
            return xp;
        }

        public int hitPoints() {
            return hitPoints;
        }

        public int armorClass() {
            return armorClass;
        }
    }

    public record EncounterCandidateProfile(
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
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
