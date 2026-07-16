package features.sessiongeneration.domain.catalog;

import java.math.BigDecimal;
import java.util.List;

public interface GenerationCatalog {

    CatalogSnapshot load();

    record CatalogSnapshot(
            String version,
            String contentHash,
            List<Progression> progression,
            List<ChallengeRank> challengeRanks,
            List<RoleBand> roleBands,
            List<Pattern> patterns,
            List<LootDefinition> loot,
            List<LootModifier> lootModifiers,
            List<LootRelation> lootRelations,
            List<Theme> themes,
            List<MagicDefinition> magic,
            List<MagicVariant> variants,
            List<Spell> spells,
            List<Container> containers,
            List<EnspelledRule> enspelledRules,
            List<Curse> curses
    ) {

        public CatalogSnapshot {
            progression = List.copyOf(progression);
            challengeRanks = List.copyOf(challengeRanks);
            roleBands = List.copyOf(roleBands);
            patterns = List.copyOf(patterns);
            loot = List.copyOf(loot);
            lootModifiers = List.copyOf(lootModifiers);
            lootRelations = List.copyOf(lootRelations);
            themes = List.copyOf(themes);
            magic = List.copyOf(magic);
            variants = List.copyOf(variants);
            spells = List.copyOf(spells);
            containers = List.copyOf(containers);
            enspelledRules = List.copyOf(enspelledRules);
            curses = List.copyOf(curses);
        }
    }

    record Progression(
            int level,
            long dayXp,
            long dayXpPartyFour,
            BigDecimal goldPerXp,
            long mediumXp,
            long hardXp,
            long deadlyXp,
            List<BigDecimal> magicRates
    ) {

        public Progression {
            magicRates = List.copyOf(magicRates);
        }
    }

    record ChallengeRank(String id, int code, String label, long xp, int sortOrder) {
    }

    record RoleBand(int partyLevel, String challengeRankId, Role role) {
    }

    record Pattern(String id, List<Role> roles, int sortOrder) {

        public Pattern {
            roles = List.copyOf(roles);
        }
    }

    record LootDefinition(
            String id,
            String name,
            String category,
            long baseCp,
            BigDecimal baseWeight,
            String placement,
            BigDecimal capacity,
            String allowedContainers,
            Role role,
            String type,
            List<String> modularProfiles,
            boolean canAdorn,
            String adornmentType,
            String valueForm,
            int sortOrder
    ) {

        public LootDefinition {
            modularProfiles = List.copyOf(modularProfiles);
        }
    }

    record LootModifier(
            String id,
            String kind,
            String name,
            String lootType,
            List<String> allowedProfiles,
            List<String> allowedCategories,
            String textTemplate,
            List<String> details,
            String componentType,
            int minimumQuantity,
            int maximumQuantity,
            long flatValueCp,
            int sortOrder
    ) {

        public LootModifier {
            allowedProfiles = List.copyOf(allowedProfiles);
            allowedCategories = List.copyOf(allowedCategories);
            details = List.copyOf(details);
        }
    }

    record LootRelation(String type, String sourceId, String targetId, int sortOrder) {
    }

    record Theme(String id, String name, String magicType, List<String> spellColors, int sortOrder) {

        public Theme {
            spellColors = List.copyOf(spellColors);
        }
    }

    record MagicDefinition(
            String id,
            String type,
            Rarity rarity,
            String item,
            String decisionType,
            String infoOne,
            String infoTwo,
            int sortOrder
    ) {
    }

    record MagicVariant(String id, String group, String option, int sortOrder) {
    }

    record Spell(String id, String name, int level, List<String> elements, int sortOrder) {

        public Spell {
            elements = List.copyOf(elements);
        }
    }

    record Container(String id, String name, BigDecimal capacity, boolean hidden, int sortOrder) {
    }

    record EnspelledRule(
            String id,
            String chassis,
            int spellLevel,
            Rarity rarity,
            int saveDc,
            int attackBonus,
            int maxCharges,
            String recharge,
            String baseItemRegex,
            BigDecimal maxBaseCapacity,
            int sortOrder
    ) {
    }

    record Curse(String id, String name, String effect, int weight, String appliesTo, int sortOrder) {
    }

    enum Role { MINION, SUPPORT, STANDARD, ELITE, BOSS, CARRIER, USEFUL, FLAVOR }

    enum Rarity { COMMON, UNCOMMON, RARE, VERY_RARE, LEGENDARY }
}
