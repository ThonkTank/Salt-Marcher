package features.creatures.parsing.task;

import features.creatures.parsing.input.ParseDocumentInput;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the persisted D&D Beyond monster stat-block fragment into the
 * creature-owned model.
 */
@SuppressWarnings("unused")
public final class ParseDocumentTask {

    private ParseDocumentTask() {
    }

    public static ParseDocumentInput.ParsedCreatureInput parseDocument(ParseDocumentInput input) {
        if (input == null || input.document() == null) {
            throw new IllegalArgumentException("input");
        }

        Document doc = input.document();
        features.creatures.model.Creature creature = new features.creatures.model.Creature();
        creature.Subtypes = new ArrayList<>();
        creature.Biomes = new ArrayList<>();
        creature.Traits = new ArrayList<>();
        creature.Actions = new ArrayList<>();
        creature.BonusActions = new ArrayList<>();
        creature.Reactions = new ArrayList<>();
        creature.LegendaryActions = new ArrayList<>();

        boolean isNew = doc.selectFirst("[class*=mon-stat-block-2024]") != null;
        String prefix = isNew ? "mon-stat-block-2024" : "mon-stat-block";

        parseName(doc, prefix, creature);
        parseMeta(doc, prefix, creature);
        parseAttributes(doc, prefix, isNew, creature);
        parseAbilityScores(doc, isNew, creature);
        parseTidbits(doc, prefix, isNew, creature);
        parseAllSections(doc, creature);
        parseHabitat(doc, creature);

        if (creature.ProficiencyBonus == 0 && creature.CR != null) {
            creature.ProficiencyBonus = shared.rules.service.ChallengeRatingRules.proficiencyBonus(creature.CR.model());
        }
        if (!isNew && creature.InitiativeBonus == 0 && creature.Dex != 0) {
            creature.InitiativeBonus = abilityModifier(creature.Dex);
        }

        return new ParseDocumentInput.ParsedCreatureInput(creature);
    }

    private static void parseName(Document doc, String prefix, features.creatures.model.Creature creature) {
        Element el = doc.selectFirst("." + prefix + "__name-link");
        if (el != null) creature.Name = el.text().trim();
    }

    private static void parseMeta(Document doc, String prefix, features.creatures.model.Creature creature) {
        Element el = doc.selectFirst("." + prefix + "__meta");
        if (el == null) return;
        String text = el.text().trim();

        Matcher sizeMatcher = sizePrefixPattern().matcher(text);
        if (!sizeMatcher.find()) return;

        creature.Size = capitalizeSizes(sizeMatcher.group(1).trim());
        String rest = text.substring(sizeMatcher.end());

        int splitAt = lastCommaOutsideParens(rest);
        String typePart = splitAt >= 0 ? rest.substring(0, splitAt).trim() : rest.trim();
        creature.Alignment = splitAt >= 0 ? rest.substring(splitAt + 1).trim() : null;

        int parenOpen = typePart.indexOf('(');
        String typeRaw = parenOpen >= 0 ? typePart.substring(0, parenOpen).trim() : typePart;
        if (parenOpen >= 0) {
            int parenClose = typePart.lastIndexOf(')');
            String raw = parenClose > parenOpen
                    ? typePart.substring(parenOpen + 1, parenClose).trim()
                    : typePart.substring(parenOpen + 1).trim();
            for (String value : raw.split(",")) {
                String trimmed = value.trim();
                if (!trimmed.isEmpty()) creature.Subtypes.add(trimmed);
            }
        }

        Matcher swarmMatcher = swarmPattern().matcher(typeRaw);
        if (swarmMatcher.find()) {
            String swarmSize = shared.crawler.text.CaseText.capitalizeFirst(swarmMatcher.group(1).trim());
            String baseType = shared.crawler.text.CaseText.capitalizeFirst(singularize(swarmMatcher.group(2).trim()));
            creature.CreatureType = baseType;
            creature.Subtypes.clear();
            creature.Subtypes.add("Swarm of " + swarmSize);
        } else {
            creature.CreatureType = shared.crawler.text.CaseText.capitalizeFirst(typeRaw);
        }
    }

    private static int lastCommaOutsideParens(String value) {
        int depth = 0;
        for (int i = value.length() - 1; i >= 0; i--) {
            char ch = value.charAt(i);
            if (ch == ')') depth++;
            else if (ch == '(') depth--;
            else if (ch == ',' && depth == 0) return i;
        }
        return -1;
    }

    private static String capitalizeSizes(String raw) {
        return eachSizePattern().matcher(raw).replaceAll(
                m -> shared.crawler.text.CaseText.capitalizeFirst(m.group(1)));
    }

    private static String singularize(String plural) {
        if (plural == null || plural.isEmpty()) return plural;
        String lower = plural.toLowerCase();
        if (lower.endsWith("ies")) return plural.substring(0, plural.length() - 3) + "y";
        if (lower.endsWith("s") && !lower.endsWith("ss")) return plural.substring(0, plural.length() - 1);
        return plural;
    }

    private static void parseAttributes(
            Document doc,
            String prefix,
            boolean isNew,
            features.creatures.model.Creature creature) {
        String acLabel = isNew ? "AC" : "Armor Class";
        String hpLabel = isNew ? "HP" : "Hit Points";

        String acVal = attrValue(doc, prefix, acLabel);
        if (acVal != null) creature.AC = parseInt(acVal, 10);
        creature.AcNotes = attrExtra(doc, prefix, acLabel);

        String hpVal = attrValue(doc, prefix, hpLabel);
        if (hpVal != null) creature.HP = parseInt(hpVal, 0);
        String hpExtra = attrExtra(doc, prefix, hpLabel);
        creature.HitDice = hpExtra;
        features.creatures.model.HitDice.tryParse(hpExtra).ifPresent(hitDice -> {
            creature.HitDiceCount = hitDice.count();
            creature.HitDiceSides = hitDice.sides();
            creature.HitDiceModifier = hitDice.modifier();
        });

        String speedVal = attrValue(doc, prefix, "Speed");
        if (speedVal != null) parseSpeedString(speedVal, creature);

        if (isNew) {
            String initVal = attrValue(doc, prefix, "Initiative");
            if (initVal != null) {
                Matcher matcher = initPattern().matcher(initVal.trim());
                if (matcher.find()) creature.InitiativeBonus = parseInt(matcher.group(1), 0);
            }
        }
    }

    private static void parseSpeedString(String value, features.creatures.model.Creature creature) {
        Matcher walk = walkSpeedPattern().matcher(value);
        if (walk.find()) creature.Speed = parseInt(walk.group(1), 0);

        Matcher special = specialSpeedPattern().matcher(value);
        while (special.find()) {
            int speed = parseInt(special.group(2), 0);
            switch (special.group(1).toLowerCase()) {
                case "fly": creature.FlySpeed = speed; break;
                case "swim": creature.SwimSpeed = speed; break;
                case "climb": creature.ClimbSpeed = speed; break;
                case "burrow": creature.BurrowSpeed = speed; break;
            }
        }
    }

    private static void parseAbilityScores(
            Document doc,
            boolean isNew,
            features.creatures.model.Creature creature) {
        if (isNew) {
            parseNewAbilityScores(doc, creature);
        } else {
            parseOldAbilityScores(doc, creature);
        }
    }

    private static void parseOldAbilityScores(Document doc, features.creatures.model.Creature creature) {
        for (String abbr : new String[]{"str", "dex", "con", "int", "wis", "cha"}) {
            Element stat = doc.selectFirst(".ability-block__stat--" + abbr);
            if (stat == null) continue;
            Element scoreEl = stat.selectFirst(".ability-block__score");
            if (scoreEl != null) setAbility(creature, abbr.toUpperCase(), parseInt(scoreEl.text(), 10));
        }
    }

    private static void parseNewAbilityScores(Document doc, features.creatures.model.Creature creature) {
        List<String> saveEntries = new ArrayList<>();
        for (Element table : doc.select("table.stat-table")) {
            for (Element row : table.select("tbody tr")) {
                Elements cells = row.select("th, td");
                if (cells.size() < 4) continue;
                String abbr = cells.get(0).text().trim().toUpperCase();
                int score = parseInt(cells.get(1).text(), 10);
                int save = parseInt(cells.get(3).text(), abilityModifier(score));
                setAbility(creature, abbr, score);
                if (save != abilityModifier(score)) {
                    saveEntries.add(abbr + ":" + (save >= 0 ? "+" : "") + save);
                }
            }
        }
        if (!saveEntries.isEmpty()) creature.SavingThrows = String.join(",", saveEntries);
    }

    private static void setAbility(features.creatures.model.Creature creature, String abbr, int value) {
        switch (abbr) {
            case "STR": creature.Str = value; break;
            case "DEX": creature.Dex = value; break;
            case "CON": creature.Con = value; break;
            case "INT": creature.Intel = value; break;
            case "WIS": creature.Wis = value; break;
            case "CHA": creature.Cha = value; break;
        }
    }

    private static void parseTidbits(
            Document doc,
            String prefix,
            boolean isNew,
            features.creatures.model.Creature creature) {
        String skillsRaw = tidbit(doc, prefix, "Skills");
        if (skillsRaw != null) creature.Skills = normalizeSkills(skillsRaw);

        String sensesRaw = tidbit(doc, prefix, "Senses");
        if (sensesRaw != null) parseSensesString(sensesRaw, creature);

        creature.Languages = tidbit(doc, prefix, "Languages");

        if (!isNew) {
            parseOldTidbits(doc, prefix, creature);
        } else {
            parseNewTidbits(doc, prefix, creature);
        }
    }

    private static void parseOldTidbits(
            Document doc,
            String prefix,
            features.creatures.model.Creature creature) {
        String savesRaw = tidbit(doc, prefix, "Saving Throws");
        if (savesRaw != null) creature.SavingThrows = normalizeSaves(savesRaw);

        creature.DamageVulnerabilities = tidbit(doc, prefix, "Damage Vulnerabilities");
        creature.DamageResistances = tidbit(doc, prefix, "Damage Resistances");
        creature.ConditionImmunities = tidbit(doc, prefix, "Condition Immunities");

        splitImmunities(tidbit(doc, prefix, "Damage Immunities"), creature);

        String crRaw = tidbit(doc, prefix, "Challenge");
        if (crRaw != null) {
            Matcher matcher = crOldPattern().matcher(crRaw);
            if (matcher.find()) {
                try {
                    creature.CR = features.creatures.model.ChallengeRating.of(matcher.group(1).trim());
                } catch (IllegalArgumentException e) {
                    System.err.println("ParseDocumentTask.parseDocument(): Invalid CR: " + e.getMessage());
                    creature.CR = features.creatures.model.ChallengeRating.of("0");
                }
                creature.XP = parseIntNoComma(matcher.group(2), 0);
            }
        }

        String pbRaw = tidbit(doc, prefix, "Proficiency Bonus");
        if (pbRaw != null) {
            Matcher matcher = proficiencyBonusPattern().matcher(pbRaw);
            if (matcher.find()) creature.ProficiencyBonus = parseInt(matcher.group(1), 2);
        }
    }

    private static void parseNewTidbits(
            Document doc,
            String prefix,
            features.creatures.model.Creature creature) {
        creature.DamageVulnerabilities = tidbit(doc, prefix, "Vulnerabilities");
        creature.DamageResistances = tidbit(doc, prefix, "Resistances");
        if (creature.DamageResistances == null) {
            creature.DamageResistances = tidbit(doc, prefix, "Damage Resistances");
        }

        splitImmunities(tidbit(doc, prefix, "Immunities"), creature);
        if (creature.ConditionImmunities == null) {
            creature.ConditionImmunities = tidbit(doc, prefix, "Condition Immunities");
        }

        String crRaw = tidbit(doc, prefix, "CR");
        if (crRaw != null) {
            Matcher crMatcher = crNewPattern().matcher(crRaw);
            if (crMatcher.find()) {
                try {
                    creature.CR = features.creatures.model.ChallengeRating.of(crMatcher.group(1).trim());
                } catch (IllegalArgumentException e) {
                    System.err.println("ParseDocumentTask.parseDocument(): Invalid CR: " + e.getMessage());
                    creature.CR = features.creatures.model.ChallengeRating.of("0");
                }
            }

            Matcher xpMatcher = xpNewPattern().matcher(crRaw);
            if (xpMatcher.find()) creature.XP = parseIntNoComma(xpMatcher.group(1), 0);

            Matcher pbMatcher = pbNewPattern().matcher(crRaw);
            if (pbMatcher.find()) creature.ProficiencyBonus = parseInt(pbMatcher.group(1), 2);
        }

        if (creature.ProficiencyBonus == 0) {
            String pbRaw = tidbit(doc, prefix, "Proficiency Bonus");
            if (pbRaw != null) {
                Matcher matcher = proficiencyBonusPattern().matcher(pbRaw);
                if (matcher.find()) creature.ProficiencyBonus = parseInt(matcher.group(1), 2);
            }
        }
    }

    private static void parseSensesString(String raw, features.creatures.model.Creature creature) {
        Matcher passivePerception = passivePerceptionPattern().matcher(raw);
        if (passivePerception.find()) creature.PassivePerception = parseInt(passivePerception.group(1), 10);

        List<String> entries = new ArrayList<>();
        Matcher senses = sensePattern().matcher(raw);
        while (senses.find()) {
            entries.add(senses.group(1).toLowerCase() + ":" + senses.group(2));
        }
        if (!entries.isEmpty()) creature.Senses = String.join(",", entries);
    }

    private static void parseAllSections(Document doc, features.creatures.model.Creature creature) {
        for (Element el : doc.select("div[class*=description-block-heading], p")) {
            if (el.tagName().equals("div")) {
                continue;
            }

            String currentSection = sectionHeadingForElement(el);
            List<features.creatures.model.Creature.Action> currentList = currentActionList(currentSection, creature);
            Element strong = el.selectFirst("strong");
            if (strong == null) {
                if ("legendary actions".equals(currentSection)) {
                    if (creature.LegendaryActionCount == 0) {
                        Matcher matcher = legendaryCountPattern().matcher(el.text());
                        if (matcher.find()) {
                            String group = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                            creature.LegendaryActionCount = parseInt(group, 3);
                        } else {
                            creature.LegendaryActionCount = 3;
                            System.err.println("ParseDocumentTask.parseAllSections(): "
                                    + "Legendary action count not found for '" + creature.Name
                                    + "', defaulting to 3");
                        }
                    }
                    continue;
                }
                if (!currentList.isEmpty()) {
                    features.creatures.model.Creature.Action last = currentList.get(currentList.size() - 1);
                    currentList.set(currentList.size() - 1,
                            actionWithDerivedToHit(last.Name, last.Description + "\n" + el.text().trim()));
                }
                continue;
            }

            String nameWithPeriod = strong.text().trim();
            String name = nameWithPeriod.endsWith(".")
                    ? nameWithPeriod.substring(0, nameWithPeriod.length() - 1)
                    : nameWithPeriod;

            String fullText = el.text().trim();
            if (name.endsWith(":")) {
                if (!currentList.isEmpty()) {
                    features.creatures.model.Creature.Action last = currentList.get(currentList.size() - 1);
                    currentList.set(currentList.size() - 1,
                            actionWithDerivedToHit(last.Name, last.Description + "\n" + fullText));
                }
                continue;
            }
            String description = fullText.length() > nameWithPeriod.length()
                    ? fullText.substring(nameWithPeriod.length()).trim()
                    : "";

            currentList.add(actionWithDerivedToHit(name, description));
        }
    }

    private static String sectionHeadingForElement(Element element) {
        for (Element sibling = element.previousElementSibling();
             sibling != null;
             sibling = sibling.previousElementSibling()) {
            if (sibling.tagName().equals("div") && sibling.className().contains("description-block-heading")) {
                return sibling.text().trim().toLowerCase();
            }
        }
        return "traits";
    }

    private static List<features.creatures.model.Creature.Action> currentActionList(
            String currentSection,
            features.creatures.model.Creature creature) {
        return switch (currentSection) {
            case "actions" -> creature.Actions;
            case "bonus actions" -> creature.BonusActions;
            case "reactions" -> creature.Reactions;
            case "legendary actions" -> creature.LegendaryActions;
            default -> creature.Traits;
        };
    }

    private static features.creatures.model.Creature.Action actionWithDerivedToHit(
            String name,
            String description) {
        return new features.creatures.model.Creature.Action(
                name,
                description,
                shared.creatures.parser.ActionToHitParser.extractToHitBonus(description));
    }

    private static String attrField(Document doc, String prefix, String labelText, String fieldClass) {
        for (Element label : doc.select("." + prefix + "__attribute-label")) {
            if (!label.text().trim().equalsIgnoreCase(labelText)) continue;
            for (Element sibling = label.nextElementSibling();
                 sibling != null;
                 sibling = sibling.nextElementSibling()) {
                if (sibling.hasClass(prefix + "__attribute-label")) break;
                Element val = sibling.selectFirst("." + prefix + fieldClass);
                if (val != null) return val.text().trim();
            }
        }
        return null;
    }

    private static String attrValue(Document doc, String prefix, String labelText) {
        return attrField(doc, prefix, labelText, "__attribute-data-value");
    }

    private static String attrExtra(Document doc, String prefix, String labelText) {
        String raw = attrField(doc, prefix, labelText, "__attribute-data-extra");
        return raw != null ? raw.replaceAll("^\\(|\\)$", "") : null;
    }

    private static String tidbit(Document doc, String prefix, String labelText) {
        for (Element tidbitEl : doc.select("." + prefix + "__tidbit")) {
            Element label = tidbitEl.selectFirst("." + prefix + "__tidbit-label");
            if (label != null && label.text().trim().equalsIgnoreCase(labelText)) {
                Element data = tidbitEl.selectFirst("." + prefix + "__tidbit-data");
                return data != null ? data.text().trim() : null;
            }
        }
        return null;
    }

    private static void parseHabitat(Document doc, features.creatures.model.Creature creature) {
        for (Element tag : doc.select("span.environment-tag")) {
            String name = tag.text().trim();
            if (!name.isEmpty()) creature.Biomes.add(name);
        }
    }

    private static String normalizeSaves(String raw) {
        StringBuilder sb = new StringBuilder();
        Matcher matcher = savingThrowsPattern().matcher(raw);
        while (matcher.find()) {
            if (sb.length() > 0) sb.append(',');
            sb.append(matcher.group(1)).append(':').append(matcher.group(2));
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static String normalizeSkills(String raw) {
        StringBuilder sb = new StringBuilder();
        Matcher matcher = skillsPattern().matcher(raw);
        while (matcher.find()) {
            String skill = matcher.group(1).trim();
            if (skill.isBlank()) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(skill).append(':').append(matcher.group(2));
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static void splitImmunities(String raw, features.creatures.model.Creature creature) {
        if (raw == null) return;
        if (raw.contains(";")) {
            String[] parts = raw.split(";", 2);
            creature.DamageImmunities = parts[0].trim();
            if (creature.ConditionImmunities == null) creature.ConditionImmunities = parts[1].trim();
        } else {
            creature.DamageImmunities = raw;
        }
    }

    static int abilityModifier(int score) {
        return Math.floorDiv(score - 10, 2);
    }

    private static int parseInt(String value, int def) {
        if (value == null) return def;
        value = parseIntNormalizePattern().matcher(value.trim()).replaceAll("");
        value = parseIntParensPattern().matcher(value).replaceAll("");
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static int parseIntNoComma(String value, int def) {
        if (value == null) return def;
        return parseInt(value, def);
    }

    private static Pattern sizePrefixPattern() {
        return Pattern.compile(
                "^((?:(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\\s+or\\s+)?)+)\\s+",
                Pattern.CASE_INSENSITIVE);
    }

    private static Pattern swarmPattern() {
        return Pattern.compile(
                "^swarm of (Tiny|Small|Medium|Large|Huge|Gargantuan)\\s+(.+)",
                Pattern.CASE_INSENSITIVE);
    }

    private static Pattern eachSizePattern() {
        return Pattern.compile("(Tiny|Small|Medium|Large|Huge|Gargantuan)", Pattern.CASE_INSENSITIVE);
    }

    private static Pattern initPattern() {
        return Pattern.compile("^([+-]?\\d+)");
    }

    private static Pattern walkSpeedPattern() {
        return Pattern.compile("^(\\d+)\\s*ft");
    }

    private static Pattern specialSpeedPattern() {
        return Pattern.compile("(fly|swim|climb|burrow)\\s+(\\d+)\\s*ft", Pattern.CASE_INSENSITIVE);
    }

    private static Pattern passivePerceptionPattern() {
        return Pattern.compile("(?i)passive\\s+perception\\s+(\\d+)");
    }

    private static Pattern sensePattern() {
        return Pattern.compile("(?i)(Darkvision|Blindsight|Truesight|Tremorsense)\\s+(\\d+)\\s*ft");
    }

    private static Pattern savingThrowsPattern() {
        return Pattern.compile("([A-Z]{3})\\s+([+-]\\d+)");
    }

    private static Pattern skillsPattern() {
        return Pattern.compile("([A-Za-z ()'']+?)\\s+([+-]\\d+)");
    }

    private static Pattern crOldPattern() {
        return Pattern.compile("([\\d/]+)\\s*\\((\\d[\\d,]*)\\s*XP\\)");
    }

    private static Pattern crNewPattern() {
        return Pattern.compile("^([\\d/]+)");
    }

    private static Pattern xpNewPattern() {
        return Pattern.compile("XP\\s*([\\d,]+)");
    }

    private static Pattern pbNewPattern() {
        return Pattern.compile("PB\\s+\\+?(\\d+)");
    }

    private static Pattern proficiencyBonusPattern() {
        return Pattern.compile("\\+?(\\d+)");
    }

    private static Pattern legendaryCountPattern() {
        return Pattern.compile("(?i)(?:uses:\\s*(\\d+)|can take\\s+(\\d+)\\s+legendary)");
    }

    private static Pattern parseIntNormalizePattern() {
        return Pattern.compile("[+,]");
    }

    private static Pattern parseIntParensPattern() {
        return Pattern.compile("[()]");
    }
}
