package src.domain.creatures.model.catalog.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;

public interface CreatureCatalogRepository {

    enum CatalogSortField {
        NAME,
        CHALLENGE_RATING,
        XP,
        HIT_POINTS,
        ARMOR_CLASS
    }

    enum CatalogSortDirection {
        ASCENDING,
        DESCENDING
    }

    record DistinctFilterValues(
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

    record CatalogSearchSpec(
            @Nullable String nameQuery,
            @Nullable Integer minimumXp,
            @Nullable Integer maximumXp,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            CatalogSortField sortField,
            CatalogSortDirection sortDirection,
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
    }

    record EncounterCandidateSpec(
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

    record CreatureIdentity(
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

    record CreatureVitals(
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

    record CreatureAbilities(
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

    record CreatureTraits(
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

    record CreatureActionData(
            String actionType,
            String name,
            String description,
            @Nullable Integer toHitBonus
    ) {
        public CreatureActionData {
            actionType = actionType == null ? "" : actionType;
            name = name == null ? "" : name;
            description = description == null ? "" : description;
        }
    }

    record CreatureProfile(
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

    record CatalogPageData(
            List<CatalogRowData> rows,
            int totalCount,
            int pageSize,
            int pageOffset
    ) {
        public CatalogPageData {
            rows = rows == null ? List.of() : List.copyOf(rows);
            totalCount = Math.max(0, totalCount);
            pageSize = Math.max(0, pageSize);
            pageOffset = Math.max(0, pageOffset);
        }

        @Override
        public List<CatalogRowData> rows() {
            return List.copyOf(rows);
        }
    }

    record CatalogRowData(
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
        public CatalogRowData {
            name = name == null ? "" : name;
            size = size == null ? "" : size;
            creatureType = creatureType == null ? "" : creatureType;
            alignment = alignment == null ? "" : alignment;
            challengeRating = challengeRating == null ? "" : challengeRating;
        }
    }

    record EncounterCandidateProfile(
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

    DistinctFilterValues loadFilterValues();

    CatalogPageData searchCatalog(CatalogSearchSpec spec);

    @Nullable CreatureProfile loadCreatureDetail(long creatureId);

    List<EncounterCandidateProfile> loadEncounterCandidates(EncounterCandidateSpec spec);

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
