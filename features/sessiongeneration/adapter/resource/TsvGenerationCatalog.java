package features.sessiongeneration.adapter.resource;

import features.sessiongeneration.domain.catalog.GenerationCatalog;
import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.catalog.GenerationCatalog.ChallengeRank;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Container;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Curse;
import features.sessiongeneration.domain.catalog.GenerationCatalog.EnspelledRule;
import features.sessiongeneration.domain.catalog.GenerationCatalog.LootDefinition;
import features.sessiongeneration.domain.catalog.GenerationCatalog.LootModifier;
import features.sessiongeneration.domain.catalog.GenerationCatalog.LootRelation;
import features.sessiongeneration.domain.catalog.GenerationCatalog.MagicDefinition;
import features.sessiongeneration.domain.catalog.GenerationCatalog.MagicVariant;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Pattern;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Progression;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Rarity;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Role;
import features.sessiongeneration.domain.catalog.GenerationCatalog.RoleBand;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Spell;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Theme;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.HashSet;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;

public final class TsvGenerationCatalog implements GenerationCatalog {

    public static final String CATALOG_VERSION = "catalog-2026-07-16";
    private static final String ROOT = "sessiongeneration/" + CATALOG_VERSION + "/";
    private static final Set<String> REQUIRED_TABLES = Set.of(
            "DB_Progression.tsv", "DB_CR.tsv", "DB_EncounterRoleBands.tsv", "DB_EncounterPatterns.tsv",
            "DB_LootItems.tsv", "DB_LootModifiers.tsv", "DB_LootRelations.tsv", "DB_Themes.tsv",
            "DB_MagicItems.tsv", "DB_MagicVariants.tsv", "DB_MagicDecisionTypes.tsv", "DB_Spells.tsv",
            "DB_Containers.tsv", "DB_EnspelledRules.tsv", "DB_MagicCurses.tsv", "DB_LootSources.tsv");
    private static final java.util.regex.Pattern VERSION_PATTERN = java.util.regex.Pattern.compile(
            "\\\"catalogVersion\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final java.util.regex.Pattern SOURCE_HASH_PATTERN = java.util.regex.Pattern.compile(
            "\\\"sourceSha256\\\"\\s*:\\s*\\\"([0-9a-f]{64})\\\"");
    private static final java.util.regex.Pattern CONTENT_HASH_PATTERN = java.util.regex.Pattern.compile(
            "\\\"catalogContentHash\\\"\\s*:\\s*\\\"([0-9a-f]{64})\\\"");
    private static final java.util.regex.Pattern SOURCE_URL_PATTERN = java.util.regex.Pattern.compile(
            "\\\"sourceUrl\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final java.util.regex.Pattern TABLE_PATTERN = java.util.regex.Pattern.compile(
            "\\{\\s*\\\"columns\\\"\\s*:\\s*(\\d+)\\s*,\\s*"
                    + "\\\"file\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"\\s*,\\s*"
                    + "\\\"name\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"\\s*,\\s*"
                    + "\\\"rows\\\"\\s*:\\s*(\\d+)\\s*,\\s*"
                    + "\\\"sha256\\\"\\s*:\\s*\\\"([0-9a-f]{64})\\\"\\s*\\}",
            java.util.regex.Pattern.DOTALL);
    private static final Set<String> RELATION_TYPES = Set.of(
            "ITEM_CONTAINER", "MODIFIER_CATEGORY", "MODIFIER_PROFILE", "THEME_CATEGORY");
    private static final Set<String> MAGIC_DECISION_TYPES = Set.of(
            "none", "spell_level", "variant_group", "fixed_variant", "enspelled_item");

    private final ResourceLoader resources;
    private volatile CatalogSnapshot snapshot;

    public TsvGenerationCatalog() {
        this(TsvGenerationCatalog::readClasspathResource);
    }

    TsvGenerationCatalog(ResourceLoader resources) {
        this.resources = Objects.requireNonNull(resources, "resources");
    }

    @Override
    public CatalogSnapshot load() {
        CatalogSnapshot current = snapshot;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (snapshot == null) {
                snapshot = loadVerified();
            }
            return snapshot;
        }
    }

    private CatalogSnapshot loadVerified() {
        Manifest manifest = parseManifest(resources.read("manifest.json"));
        Map<String, Table> tables = new LinkedHashMap<>();
        for (TableSpec spec : manifest.tables()) {
            byte[] bytes = resources.read(spec.file());
            String digest = sha256(bytes);
            if (!spec.sha256().equals(digest)) {
                throw new IllegalStateException("catalog digest mismatch for " + spec.file());
            }
            Table table = Table.parse(bytes);
            if (table.rows().size() != spec.rows() || table.header().size() != spec.columns()) {
                throw new IllegalStateException("catalog dimensions mismatch for " + spec.file());
            }
            tables.put(spec.file(), table);
        }
        List<Progression> progression = progression(tables.get("DB_Progression.tsv"));
        List<ChallengeRank> challengeRanks = challengeRanks(tables.get("DB_CR.tsv"));
        List<RoleBand> roleBands = roleBands(tables.get("DB_EncounterRoleBands.tsv"));
        List<Pattern> patterns = patterns(tables.get("DB_EncounterPatterns.tsv"));
        List<LootDefinition> loot = loot(tables.get("DB_LootItems.tsv"));
        List<LootModifier> modifiers = modifiers(tables.get("DB_LootModifiers.tsv"));
        List<LootRelation> relations = relations(tables.get("DB_LootRelations.tsv"));
        List<Theme> themes = themes(tables.get("DB_Themes.tsv"));
        List<MagicDefinition> magic = magic(tables.get("DB_MagicItems.tsv"));
        List<MagicVariant> variants = variants(tables.get("DB_MagicVariants.tsv"));
        List<MagicDecisionType> decisionTypes = decisionTypes(tables.get("DB_MagicDecisionTypes.tsv"));
        List<Spell> spells = spells(tables.get("DB_Spells.tsv"));
        List<Container> containers = containers(tables.get("DB_Containers.tsv"));
        List<EnspelledRule> enspelledRules = enspelledRules(tables.get("DB_EnspelledRules.tsv"));
        List<Curse> curses = curses(tables.get("DB_MagicCurses.tsv"));
        List<LootSource> sources = lootSources(tables.get("DB_LootSources.tsv"));
        validateCatalog(tables, progression, challengeRanks, roleBands, patterns, loot, modifiers, relations,
                themes, magic, variants, decisionTypes, spells, containers, enspelledRules, curses, sources);
        return new CatalogSnapshot(
                CATALOG_VERSION,
                manifest.contentHash(), progression, challengeRanks, roleBands, patterns, loot, modifiers,
                relations, themes, magic, variants, spells, containers, enspelledRules, curses);
    }

    private static List<Progression> progression(Table table) {
        List<Progression> result = new ArrayList<>();
        for (Row row : table.rows()) {
            result.add(new Progression(
                    row.integer("Level"),
                    row.longValue("Day_XP_Per_Character"),
                    row.longValue("Day_XP_Party_4"),
                    row.decimalOrZero("Gold_Per_XP"),
                    row.longValue("Medium_XP_Per_Character"),
                    row.longValue("Hard_XP_Per_Character"),
                    row.longValue("Deadly_XP_Per_Character"),
                    List.of(
                            row.decimalOrZero("Common_Per_XP"),
                            row.decimalOrZero("Uncommon_Per_XP"),
                            row.decimalOrZero("Rare_Per_XP"),
                            row.decimalOrZero("Very_Rare_Per_XP"),
                            row.decimalOrZero("Legendary_Per_XP"))));
        }
        return List.copyOf(result);
    }

    private static List<ChallengeRank> challengeRanks(Table table) {
        List<ChallengeRank> result = new ArrayList<>();
        for (Row row : table.rows()) {
            if (row.bool("Active")) {
                result.add(new ChallengeRank(
                        row.text("CR_ID"), row.integer("CR_Code"), row.text("CR_Label"),
                        row.longValue("XP"), row.integer("Sort_Order")));
            }
        }
        return List.copyOf(result);
    }

    private static List<RoleBand> roleBands(Table table) {
        List<RoleBand> result = new ArrayList<>();
        for (Row row : table.rows()) {
            if (row.bool("Active")) {
                result.add(new RoleBand(row.integer("Party_Level"), row.text("CR_ID"), role(row.text("Role"))));
            }
        }
        return List.copyOf(result);
    }

    private static List<Pattern> patterns(Table table) {
        List<Pattern> result = new ArrayList<>();
        for (Row row : table.rows()) {
            if (!row.bool("Active")) {
                continue;
            }
            List<Role> roles = new ArrayList<>();
            for (String column : List.of("Role_1", "Role_2", "Role_3")) {
                if (!row.text(column).isBlank()) {
                    roles.add(role(row.text(column)));
                }
            }
            result.add(new Pattern(row.text("Pattern_ID"), roles, row.integer("Sort_Order")));
        }
        return List.copyOf(result);
    }

    private static List<LootDefinition> loot(Table table) {
        List<LootDefinition> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            order++;
            if (!row.bool("Active")) {
                continue;
            }
            result.add(new LootDefinition(
                    row.text("Item_ID"), row.text("Name"), row.text("Category"), row.longValue("Base_CP"),
                    row.decimalOrZero("Base_LB"), row.text("Loot_Form_Override"),
                    row.decimalOrZero("Capacity_Units"), row.text("Allowed_Containers_Cache"),
                    role(row.text("Loot_Class")), row.text("Loot_Type"),
                    csv(row.text("Modular_Profile_Cache")), row.bool("Can_Adorn"), row.text("Adornment_Type"),
                    row.text("Value_Form"), order));
        }
        return List.copyOf(result);
    }

    private static List<LootModifier> modifiers(Table table) {
        List<LootModifier> result = new ArrayList<>();
        for (Row row : table.rows()) {
            if (!row.bool("Active")) continue;
            result.add(new LootModifier(
                    row.text("Modifier_ID"), row.text("Modifier_Kind"), row.text("Name"), row.text("Loot_Type"),
                    csv(row.text("Allowed_Profiles_Cache")), csv(row.text("Allowed_Categories_Cache")),
                    row.text("Text_Template"), pipe(row.text("Details")), row.text("Component_Type"),
                    row.integer("Min_Qty"), row.integer("Max_Qty"), row.longValue("Flat_Value_CP"),
                    row.integer("Source_Row")));
        }
        return List.copyOf(result);
    }

    private static List<LootRelation> relations(Table table) {
        List<LootRelation> result = new ArrayList<>();
        Map<String, Integer> nextOrder = new LinkedHashMap<>();
        for (Row row : table.rows()) {
            if (row.bool("Active")) {
                String relationType = row.text("Relation_Type");
                String sourceId = row.text("Source_ID");
                String orderKey = relationType + "\u0000" + sourceId;
                String rawOrder = row.text("Sort_Order").trim();
                int order = rawOrder.isEmpty() ? nextOrder.getOrDefault(orderKey, 0) + 1 : row.integer("Sort_Order");
                if (order <= nextOrder.getOrDefault(orderKey, 0)) {
                    throw new IllegalStateException("catalog relation order is duplicate or descending: " + orderKey);
                }
                nextOrder.put(orderKey, order);
                result.add(new LootRelation(
                        relationType, sourceId, row.text("Target_ID"), order));
            }
        }
        return List.copyOf(result);
    }

    private static List<Theme> themes(Table table) {
        List<Theme> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            order++;
            if (row.bool("Active")) {
                result.add(new Theme(
                        row.text("Theme_ID"), row.text("Theme"), row.text("Magic_Type"),
                        csv(row.text("Spell_Colors")), order));
            }
        }
        return List.copyOf(result);
    }

    private static List<MagicDefinition> magic(Table table) {
        List<MagicDefinition> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            order++;
            if (row.bool("Active")) {
                result.add(new MagicDefinition(
                        row.text("Magic_Item_ID"), row.text("Type"), rarity(row.text("Rarity")),
                        row.text("Item"), row.text("Decision_Type"), row.text("Info_1"), row.text("Info_2"), order));
            }
        }
        return List.copyOf(result);
    }

    private static List<MagicVariant> variants(Table table) {
        List<MagicVariant> result = new ArrayList<>();
        for (Row row : table.rows()) {
            if (row.bool("Active")) {
                result.add(new MagicVariant(
                        row.text("Magic_Variant_ID"), row.text("Group_Key"), row.text("Option"),
                        row.integer("Sort_Order")));
            }
        }
        return List.copyOf(result);
    }

    private static List<Spell> spells(Table table) {
        List<Spell> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            result.add(new Spell(
                    row.text("Spell_ID"), row.text("Spell"), row.integer("Level"),
                    csv(row.text("Elements")), order++));
        }
        return List.copyOf(result);
    }

    private static List<Container> containers(Table table) {
        List<Container> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            result.add(new Container(
                    row.text("Container_ID"), row.text("Container"), row.decimalOrZero("Capacity_Units"),
                    row.bool("Hide_In_Output"), order++));
        }
        return List.copyOf(result);
    }

    private static List<EnspelledRule> enspelledRules(Table table) {
        List<EnspelledRule> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            order++;
            if (row.bool("Active")) {
                result.add(new EnspelledRule(
                        row.text("Rule_ID"), row.text("Chassis"), row.integer("Spell_Level"),
                        rarity(row.text("Rarity")), row.integer("Save_DC"), row.integer("Attack_Bonus"),
                        row.integer("Max_Charges"), row.text("Recharge"), row.text("Base_Item_Regex"),
                        row.decimalOrZero("Max_Base_Capacity"), order));
            }
        }
        return List.copyOf(result);
    }

    private static List<Curse> curses(Table table) {
        List<Curse> result = new ArrayList<>();
        int order = 0;
        for (Row row : table.rows()) {
            order++;
            if (row.bool("Active")) {
                result.add(new Curse(
                        row.text("Curse_ID"), row.text("Name"), row.text("Effect"),
                        Math.max(1, row.integer("Weight")), row.text("Applies_To"), order));
            }
        }
        return List.copyOf(result);
    }

    private static List<MagicDecisionType> decisionTypes(Table table) {
        List<MagicDecisionType> result = new ArrayList<>();
        for (Row row : table.rows()) {
            if (row.bool("Active")) {
                result.add(new MagicDecisionType(
                        row.text("Decision_Type_ID"), row.text("Decision_Type"), row.text("Meaning"),
                        row.text("Info_1"), row.text("Info_2"), row.text("Source")));
            }
        }
        return List.copyOf(result);
    }

    private static List<LootSource> lootSources(Table table) {
        List<LootSource> result = new ArrayList<>();
        for (Row row : table.rows()) {
            result.add(new LootSource(
                    row.text("Source_ID"), row.text("Title"), row.text("URL"), row.text("Use"),
                    row.text("Accessed")));
        }
        return List.copyOf(result);
    }

    private static void validateCatalog(
            Map<String, Table> tables,
            List<Progression> progression,
            List<ChallengeRank> challengeRanks,
            List<RoleBand> roleBands,
            List<Pattern> patterns,
            List<LootDefinition> loot,
            List<LootModifier> modifiers,
            List<LootRelation> relations,
            List<Theme> themes,
            List<MagicDefinition> magic,
            List<MagicVariant> variants,
            List<MagicDecisionType> decisionTypes,
            List<Spell> spells,
            List<Container> containers,
            List<EnspelledRule> enspelledRules,
            List<Curse> curses,
            List<LootSource> sources
    ) {
        validateAllIdentities(tables);
        unique(progression.stream().map(Progression::level).toList(), "progression level");
        if (!new HashSet<>(progression.stream().map(Progression::level).toList())
                .equals(java.util.stream.IntStream.rangeClosed(1, 20).boxed().collect(java.util.stream.Collectors.toSet()))) {
            throw new IllegalStateException("catalog progression must contain exactly levels 1 through 20");
        }
        unique(challengeRanks.stream().map(ChallengeRank::code).toList(), "challenge-rank code");
        unique(challengeRanks.stream().map(ChallengeRank::sortOrder).toList(), "challenge-rank order");
        unique(patterns.stream().map(Pattern::sortOrder).toList(), "encounter-pattern order");
        unique(variants.stream().map(value -> value.group() + "\u0000" + value.sortOrder()).toList(),
                "magic-variant group order");
        unique(relations.stream().map(value -> value.type() + "\u0000" + value.sourceId() + "\u0000"
                + value.targetId()).toList(), "loot relation endpoint");

        Set<String> challengeRankIds = challengeRanks.stream().map(ChallengeRank::id)
                .collect(java.util.stream.Collectors.toSet());
        requireReferences(roleBands.stream().map(RoleBand::challengeRankId).toList(), challengeRankIds,
                "encounter role-band CR");
        Set<String> lootIds = values(tables.get("DB_LootItems.tsv"), "Item_ID");
        Set<String> modifierIds = values(tables.get("DB_LootModifiers.tsv"), "Modifier_ID");
        Set<String> containerIds = containers.stream().map(Container::id).collect(java.util.stream.Collectors.toSet());
        Set<String> themeIds = values(tables.get("DB_Themes.tsv"), "Theme_ID");
        Set<String> categories = values(tables.get("DB_LootItems.tsv"), "Category");
        Set<String> categoryIds = categories.stream().map(value -> "category:" + slug(value))
                .collect(java.util.stream.Collectors.toSet());
        Set<String> profileIds = tables.get("DB_LootItems.tsv").rows().stream()
                .flatMap(row -> csv(row.text("Modular_Profile_Cache")).stream())
                .map(value -> "profile:" + slug(value)).collect(java.util.stream.Collectors.toSet());
        for (LootRelation relation : relations) {
            if (!RELATION_TYPES.contains(relation.type())) {
                throw new IllegalStateException("unknown loot relation type: " + relation.type());
            }
            switch (relation.type()) {
                case "ITEM_CONTAINER" -> requireRelation(relation, lootIds, containerIds);
                case "MODIFIER_CATEGORY" -> requireRelation(relation, modifierIds, categoryIds);
                case "MODIFIER_PROFILE" -> requireRelation(relation, modifierIds, profileIds);
                case "THEME_CATEGORY" -> requireRelation(relation, themeIds, categories);
                default -> throw new IllegalStateException("unknown loot relation type: " + relation.type());
            }
        }

        Set<String> decisionCodes = decisionTypes.stream().map(MagicDecisionType::code)
                .collect(java.util.stream.Collectors.toSet());
        if (!decisionCodes.equals(MAGIC_DECISION_TYPES)) {
            throw new IllegalStateException("catalog magic decision vocabulary is incomplete or unknown");
        }
        unique(decisionTypes.stream().map(MagicDecisionType::code).toList(), "magic decision code");
        Set<String> variantGroups = variants.stream().map(MagicVariant::group)
                .collect(java.util.stream.Collectors.toSet());
        for (MagicDefinition definition : magic) {
            if (!decisionCodes.contains(definition.decisionType())) {
                throw new IllegalStateException("magic item references unknown decision type: " + definition.id());
            }
            if (definition.decisionType().equals("variant_group") && !variantGroups.contains(definition.infoOne())) {
                throw new IllegalStateException("magic item references unknown variant group: " + definition.id());
            }
        }
        if (spells.isEmpty() || enspelledRules.isEmpty() || curses.isEmpty()) {
            throw new IllegalStateException("catalog magic families must not be empty");
        }
        unique(sources.stream().map(LootSource::url).toList(), "loot source URL");
        for (LootSource source : sources) {
            if (source.title().isBlank() || source.use().isBlank()
                    || !(source.url().startsWith("https://") || source.url().startsWith("http://"))) {
                throw new IllegalStateException("catalog loot source provenance is invalid: " + source.id());
            }
            try {
                LocalDate.parse(source.accessed());
            } catch (DateTimeParseException exception) {
                throw new IllegalStateException("catalog loot source access date is invalid: " + source.id(), exception);
            }
        }
    }

    private static void validateAllIdentities(Map<String, Table> tables) {
        Map<String, String> identityColumns = Map.ofEntries(
                Map.entry("DB_Progression.tsv", "Level_ID"), Map.entry("DB_CR.tsv", "CR_ID"),
                Map.entry("DB_EncounterRoleBands.tsv", "Role_Band_ID"),
                Map.entry("DB_EncounterPatterns.tsv", "Pattern_ID"), Map.entry("DB_LootItems.tsv", "Item_ID"),
                Map.entry("DB_LootModifiers.tsv", "Modifier_ID"), Map.entry("DB_Themes.tsv", "Theme_ID"),
                Map.entry("DB_MagicItems.tsv", "Magic_Item_ID"),
                Map.entry("DB_MagicVariants.tsv", "Magic_Variant_ID"),
                Map.entry("DB_MagicDecisionTypes.tsv", "Decision_Type_ID"),
                Map.entry("DB_Spells.tsv", "Spell_ID"), Map.entry("DB_Containers.tsv", "Container_ID"),
                Map.entry("DB_EnspelledRules.tsv", "Rule_ID"), Map.entry("DB_MagicCurses.tsv", "Curse_ID"),
                Map.entry("DB_LootSources.tsv", "Source_ID"));
        for (Map.Entry<String, String> entry : identityColumns.entrySet()) {
            List<String> identities = tables.get(entry.getKey()).rows().stream()
                    .map(row -> required(row.text(entry.getValue()), entry.getKey() + " identity")).toList();
            unique(identities, entry.getKey() + " identity");
        }
        for (Row row : tables.get("DB_LootRelations.tsv").rows()) {
            required(row.text("Relation_Type"), "loot relation type");
            required(row.text("Source_ID"), "loot relation source");
            required(row.text("Target_ID"), "loot relation target");
        }
    }

    private static void requireRelation(LootRelation relation, Set<String> sources, Set<String> targets) {
        if (!sources.contains(relation.sourceId()) || !targets.contains(relation.targetId())) {
            throw new IllegalStateException("broken " + relation.type() + " relation: "
                    + relation.sourceId() + " -> " + relation.targetId());
        }
    }

    private static void requireReferences(List<String> references, Set<String> targets, String label) {
        for (String reference : references) {
            if (!targets.contains(reference)) {
                throw new IllegalStateException("broken " + label + " reference: " + reference);
            }
        }
    }

    private static Set<String> values(Table table, String column) {
        return table.rows().stream().map(row -> row.text(column)).filter(value -> !value.isBlank())
                .collect(java.util.stream.Collectors.toSet());
    }

    private static <T> void unique(List<T> values, String label) {
        if (new HashSet<>(values).size() != values.size()) {
            throw new IllegalStateException("catalog contains duplicate " + label);
        }
    }

    private static String required(String value, String label) {
        if (value.isBlank()) throw new IllegalStateException("catalog " + label + " is blank");
        return value;
    }

    private static String slug(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replace('_', '-').replace(' ', '-');
    }

    private static Manifest parseManifest(byte[] bytes) {
        String json = new String(bytes, StandardCharsets.UTF_8);
        Matcher version = VERSION_PATTERN.matcher(json);
        Matcher contentHash = CONTENT_HASH_PATTERN.matcher(json);
        Matcher sourceHash = SOURCE_HASH_PATTERN.matcher(json);
        Matcher sourceUrl = SOURCE_URL_PATTERN.matcher(json);
        if (!version.find() || !version.group(1).equals(CATALOG_VERSION) || !contentHash.find()
                || !sourceHash.find() || !sourceUrl.find() || sourceUrl.group(1).isBlank()) {
            throw new IllegalStateException("catalog manifest header is invalid");
        }
        List<TableSpec> tables = new ArrayList<>();
        Matcher matcher = TABLE_PATTERN.matcher(json);
        while (matcher.find()) {
            String file = matcher.group(2);
            String expectedName = file.endsWith(".tsv") ? file.substring(0, file.length() - 4) : "";
            if (!matcher.group(3).equals(expectedName)) {
                throw new IllegalStateException("catalog manifest table name does not match file: " + file);
            }
            tables.add(new TableSpec(
                    file, matcher.group(3), Integer.parseInt(matcher.group(4)), Integer.parseInt(matcher.group(1)),
                    matcher.group(5)));
        }
        if (tables.size() != REQUIRED_TABLES.size()
                || !tables.stream().map(TableSpec::file).collect(java.util.stream.Collectors.toSet())
                        .equals(REQUIRED_TABLES)) {
            throw new IllegalStateException("catalog manifest table inventory is invalid");
        }
        String recomputedContentHash = catalogContentHash(version.group(1), tables);
        if (!contentHash.group(1).equals(recomputedContentHash)) {
            throw new IllegalStateException("catalog artifact hash mismatch");
        }
        return new Manifest(contentHash.group(1), sourceHash.group(1), sourceUrl.group(1), List.copyOf(tables));
    }

    private static String catalogContentHash(String version, List<TableSpec> tables) {
        StringBuilder canonical = new StringBuilder("catalogVersion\t").append(version).append('\n');
        tables.stream().sorted(Comparator.comparing(TableSpec::file)).forEach(table -> canonical
                .append(table.file()).append('\t').append(table.name()).append('\t')
                .append(table.rows()).append('\t').append(table.columns()).append('\t')
                .append(table.sha256()).append('\n'));
        return sha256(canonical.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] readClasspathResource(String file) {
        try (InputStream input = TsvGenerationCatalog.class.getClassLoader().getResourceAsStream(ROOT + file)) {
            if (input == null) {
                throw new IllegalStateException("catalog resource missing: " + file);
            }
            return input.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalStateException("catalog resource unreadable: " + file, exception);
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private static Role role(String value) {
        return Role.valueOf(value.trim().replace(' ', '_').toUpperCase(Locale.ROOT));
    }

    private static Rarity rarity(String value) {
        return Rarity.valueOf(value.trim().replace(' ', '_').toUpperCase(Locale.ROOT));
    }

    private static List<String> csv(String value) {
        if (value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).map(String::trim).filter(text -> !text.isEmpty()).toList();
    }

    private static List<String> pipe(String value) {
        if (value.isBlank()) return List.of();
        return Arrays.stream(value.split("\\|", -1)).map(String::trim)
                .filter(text -> !text.isEmpty()).toList();
    }

    private record TableSpec(String file, String name, int rows, int columns, String sha256) {
    }

    private record Manifest(String contentHash, String sourceHash, String sourceUrl, List<TableSpec> tables) {
    }

    private record MagicDecisionType(
            String id, String code, String meaning, String infoOne, String infoTwo, String source) {
    }

    private record LootSource(String id, String title, String url, String use, String accessed) {
    }

    @FunctionalInterface
    interface ResourceLoader {
        byte[] read(String file);
    }

    private record Table(List<String> header, List<Row> rows) {

        static Table parse(byte[] bytes) {
            List<String> lines = new String(bytes, StandardCharsets.UTF_8).lines().toList();
            if (lines.isEmpty()) {
                throw new IllegalStateException("catalog table is empty");
            }
            List<String> header = List.of(lines.getFirst().split("\\t", -1));
            List<Row> rows = new ArrayList<>();
            for (int index = 1; index < lines.size(); index++) {
                String[] values = lines.get(index).split("\\t", -1);
                if (values.length > header.size()) {
                    throw new IllegalStateException("catalog row has unexpected column count at line " + (index + 1));
                }
                if (values.length < header.size()) {
                    values = Arrays.copyOf(values, header.size());
                    for (int column = 0; column < values.length; column++) {
                        if (values[column] == null) values[column] = "";
                    }
                }
                rows.add(new Row(header, List.of(values)));
            }
            return new Table(header, List.copyOf(rows));
        }
    }

    private record Row(List<String> header, List<String> values) {

        String text(String column) {
            int index = header.indexOf(column);
            if (index < 0) {
                throw new IllegalStateException("catalog column missing: " + column);
            }
            return Objects.requireNonNull(values.get(index));
        }

        BigDecimal decimalOrZero(String column) {
            String value = text(column).trim();
            return value.isEmpty() ? BigDecimal.ZERO : new BigDecimal(value);
        }

        int integer(String column) {
            return decimalOrZero(column).setScale(0, java.math.RoundingMode.HALF_UP).intValueExact();
        }

        long longValue(String column) {
            return decimalOrZero(column).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact();
        }

        boolean bool(String column) {
            String value = text(column).trim();
            if (!value.equals("true") && !value.equals("false")) {
                throw new IllegalStateException("catalog boolean is invalid in " + column + ": " + value);
            }
            return Boolean.parseBoolean(value);
        }
    }
}
