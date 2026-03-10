package features.spells.importer;

import features.spells.model.Spell;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class HtmlSpellParser {
    private static final Pattern LABEL_PATTERN = Pattern.compile(
            "^(level|school|casting time|range(?:/area)?|components|duration|attack/save|damage/effect|classes):\\s*(.+)$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern MATERIAL_COMPONENT_PATTERN = Pattern.compile(
            "\\bM\\s*\\((.+?)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern LEVEL_SCHOOL_PATTERN = Pattern.compile(
            "(?i)\\b(cantrip|\\d+(?:st|nd|rd|th)\\s+level)\\b\\s+([a-z ]+)");
    private static final Pattern ACTION_CAST_PATTERN = Pattern.compile(
            "(?i)\\b(1|one)\\s+action\\b");
    private static final Pattern BONUS_ACTION_CAST_PATTERN = Pattern.compile(
            "(?i)\\b(1|one)\\s+bonus action\\b");
    private static final Pattern REACTION_CAST_PATTERN = Pattern.compile(
            "(?i)\\b(1|one)\\s+reaction\\b");
    private static final Pattern LONG_CAST_PATTERN = Pattern.compile(
            "(?i)\\b(\\d+|one)\\s+(minute|hour|rounds?)\\b");
    private static final Pattern DICE_PATTERN = Pattern.compile(
            "(\\d+)\\s*d\\s*(\\d+)(?:\\s*([+-])\\s*(\\d+))?",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern FLAT_DAMAGE_PATTERN = Pattern.compile(
            "(\\d+)\\s+([a-z]+)\\s+damage", Pattern.CASE_INSENSITIVE);

    private static final Set<String> DAMAGE_TYPES = Set.of(
            "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
            "piercing", "poison", "psychic", "radiant", "slashing", "thunder");
    private static final Set<String> CONTROL_KEYWORDS = Set.of(
            "restrained", "paralyzed", "stunned", "incapacitated", "blinded", "charmed",
            "frightened", "prone", "grappled", "banished");

    private HtmlSpellParser() {
        throw new AssertionError("No instances");
    }

    public static Spell parse(Document doc) {
        Spell spell = new Spell();
        spell.Classes = new ArrayList<>();
        spell.DamageTypes = new ArrayList<>();
        spell.Tags = new ArrayList<>();

        spell.Name = extractName(doc);
        spell.Source = extractSource(doc);

        Map<String, String> fields = extractFields(doc);
        String subtitle = extractSubtitle(doc, fields);
        applyLevelAndSchool(spell, fields, subtitle);

        spell.CastingTime = firstNonBlank(fields.get("casting time"));
        spell.RangeText = firstNonBlank(fields.get("range/area"), fields.get("range"));
        spell.ComponentsText = firstNonBlank(fields.get("components"));
        spell.DurationText = firstNonBlank(fields.get("duration"));
        spell.AttackOrSaveText = firstNonBlank(fields.get("attack/save"));
        spell.DamageEffectText = firstNonBlank(fields.get("damage/effect"));
        spell.ClassesText = firstNonBlank(fields.get("classes"));
        spell.MaterialComponentText = extractMaterialComponent(spell.ComponentsText);
        spell.Ritual = containsWord(subtitle, "ritual");
        spell.Concentration = containsWord(spell.DurationText, "concentration")
                || containsWord(subtitle, "concentration");

        DescriptionSections sections = extractDescriptionSections(doc);
        spell.Description = sections.description();
        spell.HigherLevelsText = sections.higherLevelsText();
        spell.Ritual = spell.Ritual || containsWord(spell.Description, "ritual");
        spell.Concentration = spell.Concentration || containsWord(spell.DurationText, "concentration");

        spell.Classes = splitCsv(spell.ClassesText);
        spell.DamageTypes = detectDamageTypes(spell.DamageEffectText, spell.Description, spell.HigherLevelsText);

        DerivedAnalysis derived = deriveAnalysis(spell);
        spell.CastingChannel = derived.castingChannel();
        spell.TargetProfile = derived.targetProfile();
        spell.DeliveryType = derived.deliveryType();
        spell.IsOffensive = derived.isOffensive();
        spell.ExpectedDamageSingle = derived.expectedDamageSingle();
        spell.ExpectedDamageSmallAoe = derived.expectedDamageSmallAoe();
        spell.ExpectedDamageLargeAoe = derived.expectedDamageLargeAoe();
        spell.Tags = derived.tags();
        return spell;
    }

    private static String extractName(Document doc) {
        Element title = doc.selectFirst("h1.page-title, .page-heading h1, h1");
        return title == null ? null : cleanText(title.text());
    }

    private static String extractSource(Document doc) {
        Element source = doc.selectFirst(".source-description");
        return source == null ? null : cleanText(source.text());
    }

    private static Map<String, String> extractFields(Document doc) {
        LinkedHashMap<String, String> fields = new LinkedHashMap<>();
        Elements elements = doc.select(
                ".details-container-content-description-text, .details-container-content p, .more-info-content p,"
                        + " .primary-content p, .primary-content li, .details-container-content li");
        for (Element element : elements) {
            String text = cleanText(element.text());
            if (text.isBlank()) {
                continue;
            }
            Matcher matcher = LABEL_PATTERN.matcher(text);
            if (matcher.find()) {
                fields.putIfAbsent(matcher.group(1).toLowerCase(Locale.ROOT), cleanText(matcher.group(2)));
                continue;
            }
            Element strong = element.selectFirst("strong, b");
            if (strong == null) {
                continue;
            }
            String label = cleanText(strong.text()).replaceAll(":$", "").toLowerCase(Locale.ROOT);
            if (!LABEL_PATTERN.matcher(label + ": x").matches()) {
                continue;
            }
            String value = cleanText(text.substring(Math.min(text.length(), strong.text().length())).replaceFirst("^\\s*:\\s*", ""));
            if (!value.isBlank()) {
                fields.putIfAbsent(label, value);
            }
        }
        return fields;
    }

    private static String extractSubtitle(Document doc, Map<String, String> fields) {
        if (fields.containsKey("level") || fields.containsKey("school")) {
            return firstNonBlank(fields.get("level"), fields.get("school"));
        }
        List<String> candidates = new ArrayList<>();
        candidates.add(textOrNull(doc.selectFirst(".details-container-content-description-text")));
        candidates.add(textOrNull(doc.selectFirst(".details-container-content-description")));
        candidates.add(textOrNull(doc.selectFirst(".page-title + p")));
        candidates.add(doc.select("meta[property=og:description]").attr("content"));
        for (String candidate : candidates) {
            String cleaned = cleanText(candidate);
            if (LEVEL_SCHOOL_PATTERN.matcher(cleaned).find()) {
                return cleaned;
            }
        }
        return null;
    }

    private static void applyLevelAndSchool(Spell spell, Map<String, String> fields, String subtitle) {
        String levelText = firstNonBlank(fields.get("level"), subtitle);
        String schoolText = firstNonBlank(fields.get("school"));
        if (levelText != null) {
            Matcher matcher = LEVEL_SCHOOL_PATTERN.matcher(levelText);
            if (matcher.find()) {
                spell.Level = parseLevel(matcher.group(1));
                if (schoolText == null || schoolText.isBlank()) {
                    schoolText = matcher.group(2);
                }
            } else {
                spell.Level = parseLevel(levelText);
            }
        }
        spell.School = schoolText == null ? null : cleanSchool(schoolText);
    }

    private static DescriptionSections extractDescriptionSections(Document doc) {
        Element content = doc.selectFirst(".more-info-content, .details-container-content, .primary-content, article");
        if (content == null) {
            return new DescriptionSections(null, null);
        }
        List<String> descriptionParts = new ArrayList<>();
        List<String> higherLevelParts = new ArrayList<>();
        boolean inHigherLevels = false;
        for (Element node : content.select("h2, h3, p, li")) {
            String text = cleanText(node.text());
            if (text.isBlank() || isMetaField(text) || text.equalsIgnoreCase(extractSource(doc))) {
                continue;
            }
            String lower = text.toLowerCase(Locale.ROOT);
            if (lower.equals("at higher levels") || lower.startsWith("at higher levels.")) {
                inHigherLevels = true;
                String remainder = text.replaceFirst("(?i)^at higher levels\\.?\\s*", "");
                if (!remainder.isBlank()) {
                    higherLevelParts.add(remainder);
                }
                continue;
            }
            if (inHigherLevels) {
                higherLevelParts.add(text);
            } else {
                descriptionParts.add(text);
            }
        }
        return new DescriptionSections(
                joinLines(descriptionParts.toArray(String[]::new)),
                joinLines(higherLevelParts.toArray(String[]::new)));
    }

    private static DerivedAnalysis deriveAnalysis(Spell spell) {
        double rawDamage = estimateRawDamage(joinLines(spell.DamageEffectText, spell.Description, spell.HigherLevelsText));
        Delivery delivery = inferDelivery(spell.AttackOrSaveText, spell.Description, rawDamage);
        String castingChannel = inferCastingChannel(spell.CastingTime);
        double expectedSingle = switch (delivery) {
            case ATTACK -> rawDamage * 0.65;
            case SAVE -> rawDamage * 0.75;
            case AUTO -> rawDamage;
            case UTILITY -> 0.0;
        };
        boolean aoe = isAoeSpell(spell);
        double expectedSmallAoe = aoe ? expectedSingle * 2.0 : 0.0;
        double expectedLargeAoe = aoe ? expectedSingle * 4.0 : 0.0;
        boolean healing = containsWord(spell.Description, "regain hit points")
                || containsWord(spell.Description, "restores hit points");
        boolean summon = containsWord(spell.Description, "summon") || containsWord(spell.Description, "conjure");
        boolean mobility = containsWord(spell.Description, "teleport")
                || containsWord(spell.Description, "speed increases")
                || containsWord(spell.Description, "gain a flying speed");
        boolean control = containsControlKeyword(spell.Description);
        boolean combatCast = "action".equals(castingChannel)
                || "bonus_action".equals(castingChannel)
                || "reaction".equals(castingChannel);
        boolean offensive = combatCast && (expectedSingle > 0.0 || expectedSmallAoe > 0.0 || expectedLargeAoe > 0.0);
        String targetProfile = !offensive
                ? "utility"
                : aoe ? inferAoeScale(spell.RangeText, spell.Description, spell.DamageEffectText) : "single";

        LinkedHashSet<String> tags = new LinkedHashSet<>();
        if (spell.Ritual) tags.add("ritual");
        if (spell.Concentration) tags.add("concentration");
        if (aoe) tags.add("aoe");
        if (healing) tags.add("healing");
        if (summon) tags.add("summon");
        if (mobility) tags.add("mobility");
        if (control) tags.add("control");
        if (offensive) tags.add("damage");
        if (delivery == Delivery.ATTACK) tags.add("attack");
        if (delivery == Delivery.SAVE) tags.add("save");
        if (!offensive && !healing && !summon && !mobility && !control) tags.add("utility");

        return new DerivedAnalysis(
                castingChannel,
                targetProfile,
                delivery.dbValue,
                offensive,
                round2(expectedSingle),
                round2(expectedSmallAoe),
                round2(expectedLargeAoe),
                new ArrayList<>(tags));
    }

    private static double estimateRawDamage(String description) {
        if (description == null || description.isBlank()) {
            return 0.0;
        }
        double best = 0.0;
        Matcher diceMatcher = DICE_PATTERN.matcher(description);
        while (diceMatcher.find()) {
            int count = Integer.parseInt(diceMatcher.group(1));
            int sides = Integer.parseInt(diceMatcher.group(2));
            int modifier = 0;
            if (diceMatcher.group(3) != null && diceMatcher.group(4) != null) {
                modifier = Integer.parseInt(diceMatcher.group(4));
                if ("-".equals(diceMatcher.group(3))) {
                    modifier = -modifier;
                }
            }
            best = Math.max(best, count * ((sides + 1) / 2.0) + modifier);
        }
        Matcher flatMatcher = FLAT_DAMAGE_PATTERN.matcher(description);
        while (flatMatcher.find()) {
            best = Math.max(best, Double.parseDouble(flatMatcher.group(1)));
        }
        return best;
    }

    private static Delivery inferDelivery(String attackOrSaveText, String description, double rawDamage) {
        String joined = joinLines(attackOrSaveText, description).toLowerCase(Locale.ROOT);
        if (joined.contains("spell attack") || joined.contains("melee attack") || joined.contains("ranged attack")) {
            return Delivery.ATTACK;
        }
        if (joined.contains("saving throw") || joined.matches(".*\\b(str|dex|con|int|wis|cha)\\b.*")) {
            return Delivery.SAVE;
        }
        if (rawDamage > 0.0) {
            return Delivery.AUTO;
        }
        return Delivery.UTILITY;
    }

    private static String inferCastingChannel(String castingTime) {
        String text = cleanText(castingTime).toLowerCase(Locale.ROOT);
        if (text.isEmpty()) {
            return "action";
        }
        if (BONUS_ACTION_CAST_PATTERN.matcher(text).find()) {
            return "bonus_action";
        }
        if (REACTION_CAST_PATTERN.matcher(text).find()) {
            return "reaction";
        }
        if (ACTION_CAST_PATTERN.matcher(text).find()) {
            return "action";
        }
        if (LONG_CAST_PATTERN.matcher(text).find()) {
            return "long_cast";
        }
        return "special";
    }

    private static String inferAoeScale(String rangeText, String description, String damageEffectText) {
        String joined = joinLines(rangeText, description, damageEffectText).toLowerCase(Locale.ROOT);
        if (joined.contains("20-foot") || joined.contains("30-foot") || joined.contains("40-foot")
                || joined.contains("60-foot") || joined.contains("sphere") || joined.contains("radius")) {
            return "large_aoe";
        }
        return "small_aoe";
    }

    private static boolean isAoeSpell(Spell spell) {
        String joined = joinLines(spell.RangeText, spell.Description, spell.DamageEffectText).toLowerCase(Locale.ROOT);
        return joined.contains("cone")
                || joined.contains("cube")
                || joined.contains("line")
                || joined.contains("radius")
                || joined.contains("sphere")
                || joined.contains("cylinder")
                || joined.contains("each creature")
                || joined.contains("creatures in");
    }

    private static List<String> detectDamageTypes(String... texts) {
        LinkedHashSet<String> types = new LinkedHashSet<>();
        for (String text : texts) {
            String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
            for (String type : DAMAGE_TYPES) {
                if (lower.contains(type + " damage") || lower.equals(type) || lower.contains(type + ",")) {
                    types.add(type);
                }
            }
        }
        return new ArrayList<>(types);
    }

    private static boolean containsControlKeyword(String text) {
        String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
        for (String keyword : CONTROL_KEYWORDS) {
            if (lower.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isMetaField(String text) {
        return LABEL_PATTERN.matcher(text).find();
    }

    private static String extractMaterialComponent(String componentsText) {
        if (componentsText == null || componentsText.isBlank()) {
            return null;
        }
        Matcher matcher = MATERIAL_COMPONENT_PATTERN.matcher(componentsText);
        return matcher.find() ? cleanText(matcher.group(1)) : null;
    }

    private static int parseLevel(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        String lower = raw.toLowerCase(Locale.ROOT);
        if (lower.contains("cantrip")) {
            return 0;
        }
        Matcher matcher = Pattern.compile("(\\d+)").matcher(lower);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
    }

    private static String cleanSchool(String value) {
        if (value == null) {
            return null;
        }
        String cleaned = cleanText(value)
                .replaceAll("(?i)^cantrip\\s+", "")
                .replaceAll("(?i)^\\d+(?:st|nd|rd|th)\\s+level\\s+", "")
                .trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> parts = new LinkedHashSet<>();
        for (String token : value.split(",")) {
            String cleaned = cleanText(token);
            if (!cleaned.isEmpty()) {
                parts.add(cleaned);
            }
        }
        return new ArrayList<>(parts);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return cleanText(value);
            }
        }
        return null;
    }

    private static String textOrNull(Element element) {
        return element == null ? null : element.text();
    }

    private static boolean containsWord(String text, String word) {
        if (text == null || word == null) {
            return false;
        }
        return text.toLowerCase(Locale.ROOT).contains(word.toLowerCase(Locale.ROOT));
    }

    private static String joinLines(String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            String cleaned = cleanText(value);
            if (!cleaned.isEmpty()) {
                parts.add(cleaned);
            }
        }
        return parts.isEmpty() ? null : String.join("\n\n", parts);
    }

    private static String cleanText(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record DescriptionSections(String description, String higherLevelsText) {}

    private record DerivedAnalysis(
            String castingChannel,
            String targetProfile,
            String deliveryType,
            boolean isOffensive,
            double expectedDamageSingle,
            double expectedDamageSmallAoe,
            double expectedDamageLargeAoe,
            List<String> tags
    ) {}

    private enum Delivery {
        ATTACK("attack"),
        SAVE("save"),
        AUTO("auto"),
        UTILITY("utility");

        private final String dbValue;

        Delivery(String dbValue) {
            this.dbValue = dbValue;
        }
    }
}
