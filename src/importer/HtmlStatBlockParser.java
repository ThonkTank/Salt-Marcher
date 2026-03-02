package importer;

import entities.Creature;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parst den HTML-Inhalt eines D&D Beyond Stat-Blocks (outerHtml des .mon-stat-block Elements)
 * in ein Creature-Objekt. Nutzt Jsoup-CSS-Selektoren statt Regex für alle strukturierten Felder.
 *
 * Unterstützt beide Formate:
 *   OLD (2014 MM): CSS-Prefix "mon-stat-block__"
 *   NEW (2024):    CSS-Prefix "mon-stat-block-2024__"
 */
public class HtmlStatBlockParser {

    // Pre-compiled Patterns
    private static final Pattern SIZE_PREFIX_PATTERN = Pattern.compile(
            "^((?:(?:Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\\s+or\\s+)?)+)\\s+",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SWARM_PATTERN = Pattern.compile(
            "^swarm of (Tiny|Small|Medium|Large|Huge|Gargantuan)\\s+(.+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern EACH_SIZE_PATTERN = Pattern.compile(
            "(Tiny|Small|Medium|Large|Huge|Gargantuan)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern INIT_PATTERN = Pattern.compile("^([+-]?\\d+)");
    private static final Pattern WALK_SPEED_PATTERN = Pattern.compile("^(\\d+)\\s*ft");
    private static final Pattern SPECIAL_SPEED_PATTERN = Pattern.compile(
            "(fly|swim|climb|burrow)\\s+(\\d+)\\s*ft", Pattern.CASE_INSENSITIVE);
    private static final Pattern PASSIVE_PERCEPTION_PATTERN = Pattern.compile(
            "(?i)passive\\s+perception\\s+(\\d+)");
    private static final Pattern SENSE_PATTERN = Pattern.compile(
            "(?i)(Darkvision|Blindsight|Truesight|Tremorsense)\\s+(\\d+)\\s*ft");
    private static final Pattern SAVES_PATTERN = Pattern.compile("([A-Z]{3})\\s+([+-]\\d+)");
    private static final Pattern SKILLS_PATTERN = Pattern.compile("([A-Za-z ()'']+?)\\s+([+-]\\d+)");
    private static final Pattern CR_OLD_PATTERN = Pattern.compile("([\\d/]+)\\s*\\((\\d[\\d,]*)\\s*XP\\)");
    private static final Pattern CR_NEW_PATTERN = Pattern.compile("^([\\d/]+)");
    private static final Pattern XP_NEW_PATTERN = Pattern.compile("XP\\s*([\\d,]+)");
    private static final Pattern PB_NEW_PATTERN = Pattern.compile("PB\\s+\\+?(\\d+)");
    private static final Pattern PB_PATTERN = Pattern.compile("\\+?(\\d+)");
    private static final Pattern LEGENDARY_COUNT_PATTERN = Pattern.compile(
            "(?i)(?:uses:\\s*(\\d+)|can take\\s+(\\d+)\\s+legendary)");
    private static final Pattern PARSE_INT_STRIP = Pattern.compile("[+,]");
    private static final Pattern PARSE_INT_PARENS = Pattern.compile("[()]");

    // -------------------------------------------------------------------------
    // Stat-Block-Element finden (zentralisiert für Crawler, QuickTest, etc.)
    // -------------------------------------------------------------------------

    public static Element findStatBlock(Document doc) {
        Element block = doc.selectFirst(".mon-stat-block-2024");
        if (block == null) block = doc.selectFirst(".mon-stat-block");
        if (block == null) block = doc.selectFirst(".stat-block-background");
        if (block == null) block = doc.selectFirst("[class*=stat-block]");
        return block;
    }

    // -------------------------------------------------------------------------
    // Öffentlicher Einstiegspunkt
    // -------------------------------------------------------------------------

    public static Creature parse(Document doc) {
        Creature c = new Creature();
        c.Subtypes         = new ArrayList<>();
        c.Biomes           = new ArrayList<>();
        c.Traits           = new ArrayList<>();
        c.Actions          = new ArrayList<>();
        c.BonusActions     = new ArrayList<>();
        c.Reactions        = new ArrayList<>();
        c.LegendaryActions = new ArrayList<>();

        boolean isNew = doc.selectFirst("[class*=mon-stat-block-2024]") != null;
        String prefix = isNew ? "mon-stat-block-2024" : "mon-stat-block";

        parseName(doc, prefix, c);
        parseMeta(doc, prefix, c);
        parseAttributes(doc, prefix, isNew, c);
        parseAbilityScores(doc, isNew, c);
        parseTidbits(doc, prefix, isNew, c);
        parseAllSections(doc, c);
        parseHabitat(doc, c);

        // Fallback: ProficiencyBonus aus CR
        if (c.ProficiencyBonus == 0) c.ProficiencyBonus = crToProficiencyBonus(c.CR);
        // Fallback: InitiativeBonus aus DEX für old format
        if (!isNew && c.InitiativeBonus == 0 && c.Dex != 0)
            c.InitiativeBonus = abilityModifier(c.Dex);

        return c;
    }

    // -------------------------------------------------------------------------
    // Name
    // -------------------------------------------------------------------------

    private static void parseName(Document doc, String prefix, Creature c) {
        Element el = doc.selectFirst("." + prefix + "__name-link");
        if (el != null) c.Name = el.text().trim();
    }

    // -------------------------------------------------------------------------
    // Meta-Zeile: "Small Humanoid (Goblinoid), Neutral Evil"
    // -------------------------------------------------------------------------

    private static void parseMeta(Document doc, String prefix, Creature c) {
        Element el = doc.selectFirst("." + prefix + "__meta");
        if (el == null) return;
        String text = el.text().trim();

        // 1) Size(s) vom Anfang abtrennen: "Medium or Small Humanoid ..." -> size="Medium or Small"
        Matcher sizeMatcher = SIZE_PREFIX_PATTERN.matcher(text);
        if (!sizeMatcher.find()) return;

        c.Size = capitalizeSizes(sizeMatcher.group(1).trim());

        String rest = text.substring(sizeMatcher.end()); // z.B. "Humanoid (Human, Shapechanger)"

        // 2) Alignment: letztes Komma AUSSERHALB von Klammern finden
        int splitAt = lastCommaOutsideParens(rest);
        String typePart;
        if (splitAt >= 0) {
            typePart    = rest.substring(0, splitAt).trim();
            c.Alignment = rest.substring(splitAt + 1).trim();
        } else {
            typePart    = rest.trim();
            c.Alignment = null;
        }

        // 3) Subtypes aus Klammern extrahieren: "Humanoid (gnome, shapeshifter)" -> type="Humanoid", subtypes=["gnome","shapeshifter"]
        int parenOpen = typePart.indexOf('(');
        String typeRaw;
        if (parenOpen >= 0) {
            typeRaw = typePart.substring(0, parenOpen).trim();
            int parenClose = typePart.lastIndexOf(')');
            String raw = parenClose > parenOpen
                    ? typePart.substring(parenOpen + 1, parenClose).trim()
                    : typePart.substring(parenOpen + 1).trim();
            for (String s : raw.split(",")) {
                String trimmed = s.trim();
                if (!trimmed.isEmpty()) c.Subtypes.add(trimmed);
            }
        } else {
            typeRaw = typePart;
        }

        // 4) Swarm-Handling: "swarm of Tiny beasts" -> Type="Beast", Subtypes=["Swarm of Tiny"]
        Matcher swarmMatcher = SWARM_PATTERN.matcher(typeRaw);
        if (swarmMatcher.find()) {
            String swarmSize = capitalizeFirst(swarmMatcher.group(1).trim());
            String baseType  = capitalizeFirst(singularize(swarmMatcher.group(2).trim()));
            c.CreatureType = baseType;
            c.Subtypes.clear();
            c.Subtypes.add("Swarm of " + swarmSize);
        } else {
            c.CreatureType = capitalizeFirst(typeRaw);
        }
    }

    private static int lastCommaOutsideParens(String s) {
        int depth = 0;
        int lastComma = -1;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == '(') depth++;
            else if (ch == ')') depth--;
            else if (ch == ',' && depth == 0) lastComma = i;
        }
        return lastComma;
    }

    private static String capitalizeSizes(String raw) {
        // "medium or small" -> "Medium or Small"
        return EACH_SIZE_PATTERN.matcher(raw).replaceAll(m -> capitalizeFirst(m.group(1)));
    }

    private static String singularize(String plural) {
        if (plural == null || plural.isEmpty()) return plural;
        String lower = plural.toLowerCase();
        if (lower.endsWith("ies")) return plural.substring(0, plural.length() - 3) + "y";
        if (lower.endsWith("s") && !lower.endsWith("ss")) return plural.substring(0, plural.length() - 1);
        return plural;
    }

    // -------------------------------------------------------------------------
    // Attribute-Block: AC, HP, Speed, Initiative
    // -------------------------------------------------------------------------

    private static void parseAttributes(Document doc, String prefix, boolean isNew, Creature c) {
        String acLabel  = isNew ? "AC"         : "Armor Class";
        String hpLabel  = isNew ? "HP"         : "Hit Points";

        String acVal = attrValue(doc, prefix, acLabel);
        if (acVal != null) c.AC = parseInt(acVal, 10);
        c.AcNotes = attrExtra(doc, prefix, acLabel);

        String hpVal = attrValue(doc, prefix, hpLabel);
        if (hpVal != null) c.HP = parseInt(hpVal, 0);
        String hpExtra = attrExtra(doc, prefix, hpLabel);
        if (hpExtra != null) c.HitDice = hpExtra;

        String speedVal = attrValue(doc, prefix, "Speed");
        if (speedVal != null) parseSpeedString(speedVal, c);

        if (isNew) {
            String initVal = attrValue(doc, prefix, "Initiative");
            if (initVal != null) {
                Matcher m = INIT_PATTERN.matcher(initVal.trim());
                if (m.find()) c.InitiativeBonus = parseInt(m.group(1), 0);
            }
        }
    }

    private static void parseSpeedString(String s, Creature c) {
        Matcher walk = WALK_SPEED_PATTERN.matcher(s);
        if (walk.find()) c.Speed = parseInt(walk.group(1), 0);

        Matcher special = SPECIAL_SPEED_PATTERN.matcher(s);
        while (special.find()) {
            int val = parseInt(special.group(2), 0);
            switch (special.group(1).toLowerCase()) {
                case "fly":    c.FlySpeed    = val; break;
                case "swim":   c.SwimSpeed   = val; break;
                case "climb":  c.ClimbSpeed  = val; break;
                case "burrow": c.BurrowSpeed = val; break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Ability Scores
    // -------------------------------------------------------------------------

    private static void parseAbilityScores(Document doc, boolean isNew, Creature c) {
        if (isNew) {
            parseNewAbilityScores(doc, c);
        } else {
            parseOldAbilityScores(doc, c);
            c.InitiativeBonus = abilityModifier(c.Dex);
        }
    }

    private static void parseOldAbilityScores(Document doc, Creature c) {
        for (String abbr : new String[]{"str", "dex", "con", "int", "wis", "cha"}) {
            Element stat = doc.selectFirst(".ability-block__stat--" + abbr);
            if (stat == null) continue;
            Element scoreEl = stat.selectFirst(".ability-block__score");
            if (scoreEl != null) setAbility(c, abbr.toUpperCase(), parseInt(scoreEl.text(), 10));
        }
    }

    private static void parseNewAbilityScores(Document doc, Creature c) {
        List<String> saveEntries = new ArrayList<>();
        for (Element table : doc.select("table.stat-table")) {
            for (Element row : table.select("tbody tr")) {
                Elements cells = row.select("th, td");
                if (cells.size() < 4) continue;
                String abbr  = cells.get(0).text().trim().toUpperCase();
                int score    = parseInt(cells.get(1).text(), 10);
                int save     = parseInt(cells.get(3).text(), abilityModifier(score));
                setAbility(c, abbr, score);
                if (save != abilityModifier(score)) {
                    saveEntries.add(abbr + ":" + (save >= 0 ? "+" : "") + save);
                }
            }
        }
        if (!saveEntries.isEmpty()) c.SavingThrows = String.join(",", saveEntries);
    }

    private static void setAbility(Creature c, String abbr, int val) {
        switch (abbr) {
            case "STR": c.Str   = val; break;
            case "DEX": c.Dex   = val; break;
            case "CON": c.Con   = val; break;
            case "INT": c.Intel = val; break;
            case "WIS": c.Wis   = val; break;
            case "CHA": c.Cha   = val; break;
        }
    }

    // -------------------------------------------------------------------------
    // Tidbit-Felder: Skills, Senses, Languages, CR, Saving Throws, Immunities …
    // -------------------------------------------------------------------------

    private static void parseTidbits(Document doc, String prefix, boolean isNew, Creature c) {
        // Skills
        String skillsRaw = tidbit(doc, prefix, "Skills");
        if (skillsRaw != null) c.Skills = normalizeSkills(skillsRaw);

        // Senses
        String sensesRaw = tidbit(doc, prefix, "Senses");
        if (sensesRaw != null) parseSensesString(sensesRaw, c);

        // Languages
        c.Languages = tidbit(doc, prefix, "Languages");

        if (!isNew) {
            parseOldTidbits(doc, prefix, c);
        } else {
            parseNewTidbits(doc, prefix, c);
        }
    }

    private static void parseOldTidbits(Document doc, String prefix, Creature c) {
        // Saving Throws (old format has explicit tidbit)
        String savesRaw = tidbit(doc, prefix, "Saving Throws");
        if (savesRaw != null) c.SavingThrows = normalizeSaves(savesRaw);

        // Damage affinities
        c.DamageVulnerabilities = tidbit(doc, prefix, "Damage Vulnerabilities");
        c.DamageResistances     = tidbit(doc, prefix, "Damage Resistances");
        c.ConditionImmunities   = tidbit(doc, prefix, "Condition Immunities");

        splitImmunities(tidbit(doc, prefix, "Damage Immunities"), c);

        // CR / XP
        String crRaw = tidbit(doc, prefix, "Challenge");
        if (crRaw != null) {
            Matcher m = CR_OLD_PATTERN.matcher(crRaw);
            if (m.find()) {
                c.CR = m.group(1).trim();
                c.XP = parseIntNoComma(m.group(2), 0);
            }
        }

        // Proficiency Bonus
        String pbRaw = tidbit(doc, prefix, "Proficiency Bonus");
        if (pbRaw != null) {
            Matcher m = PB_PATTERN.matcher(pbRaw);
            if (m.find()) c.ProficiencyBonus = parseInt(m.group(1), 2);
        }
    }

    private static void parseNewTidbits(Document doc, String prefix, Creature c) {
        // Damage affinities (new labels)
        c.DamageVulnerabilities = tidbit(doc, prefix, "Vulnerabilities");
        c.DamageResistances     = tidbit(doc, prefix, "Resistances");
        if (c.DamageResistances == null)
            c.DamageResistances = tidbit(doc, prefix, "Damage Resistances");

        splitImmunities(tidbit(doc, prefix, "Immunities"), c);
        if (c.ConditionImmunities == null)
            c.ConditionImmunities = tidbit(doc, prefix, "Condition Immunities");

        // CR: "14 (XP 11,500, or 13,000 in lair; PB +5)"
        String crRaw = tidbit(doc, prefix, "CR");
        if (crRaw != null) {
            Matcher mCR = CR_NEW_PATTERN.matcher(crRaw);
            if (mCR.find()) c.CR = mCR.group(1).trim();

            Matcher mXP = XP_NEW_PATTERN.matcher(crRaw);
            if (mXP.find()) c.XP = parseIntNoComma(mXP.group(1), 0);

            Matcher mPB = PB_NEW_PATTERN.matcher(crRaw);
            if (mPB.find()) c.ProficiencyBonus = parseInt(mPB.group(1), 2);
        }

        // PB als separates Tidbit (Fallback)
        if (c.ProficiencyBonus == 0) {
            String pbRaw = tidbit(doc, prefix, "Proficiency Bonus");
            if (pbRaw != null) {
                Matcher m = PB_PATTERN.matcher(pbRaw);
                if (m.find()) c.ProficiencyBonus = parseInt(m.group(1), 2);
            }
        }
    }

    private static void parseSensesString(String raw, Creature c) {
        Matcher pp = PASSIVE_PERCEPTION_PATTERN.matcher(raw);
        if (pp.find()) c.PassivePerception = parseInt(pp.group(1), 10);

        List<String> entries = new ArrayList<>();
        Matcher sm = SENSE_PATTERN.matcher(raw);
        while (sm.find()) {
            entries.add(sm.group(1).toLowerCase() + ":" + sm.group(2));
        }
        if (!entries.isEmpty()) c.Senses = String.join(",", entries);
    }

    // -------------------------------------------------------------------------
    // Aktions-Sektionen: Traits, Actions, Bonus Actions, Reactions, Legendary
    // -------------------------------------------------------------------------

    private static void parseAllSections(Document doc, Creature c) {
        String currentSection = "traits";
        List<Creature.Action> currentList = c.Traits;

        // Sektions-Überschriften sind <div class="...__description-block-heading">, KEINE <h3>
        for (Element el : doc.select("div[class*=description-block-heading], p")) {
            if (el.tagName().equals("div")) {
                // Sektions-Überschrift
                String heading = el.text().trim().toLowerCase();
                switch (heading) {
                    case "actions":
                        currentSection = "actions";
                        currentList    = c.Actions;
                        break;
                    case "bonus actions":
                        currentSection = "bonus_actions";
                        currentList    = c.BonusActions;
                        break;
                    case "reactions":
                        currentSection = "reactions";
                        currentList    = c.Reactions;
                        break;
                    case "legendary actions":
                        currentSection = "legendary_actions";
                        currentList    = c.LegendaryActions;
                        break;
                    // "traits", "lair actions", "regional effects" etc.: currentSection unverändert
                    default:
                        break;
                }
                continue;
            }

            // <p> Element
            Element strong = el.selectFirst("strong");
            if (strong == null) {
                // Intro-Satz der Legendary Actions: Count extrahieren
                if ("legendary_actions".equals(currentSection) && c.LegendaryActionCount == 0) {
                    Matcher m = LEGENDARY_COUNT_PATTERN.matcher(el.text());
                    if (m.find()) {
                        String g = m.group(1) != null ? m.group(1) : m.group(2);
                        c.LegendaryActionCount = parseInt(g, 3);
                    } else {
                        c.LegendaryActionCount = 3;
                    }
                }
                continue;
            }

            String nameWithPeriod = strong.text().trim();
            String name = nameWithPeriod.endsWith(".")
                ? nameWithPeriod.substring(0, nameWithPeriod.length() - 1)
                : nameWithPeriod;

            // Sub-Listen (z.B. "At Will:", "1/Day Each:") überspringen
            if (name.endsWith(":")) continue;

            String fullText = el.text().trim();
            String description = fullText.length() > nameWithPeriod.length()
                ? fullText.substring(nameWithPeriod.length()).trim()
                : "";

            Creature.Action action = new Creature.Action();
            action.Name        = name;
            action.Description = description;
            currentList.add(action);
        }
    }

    // -------------------------------------------------------------------------
    // Selektor-Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Gibt den Wert eines Attribut-Felds zurück (z.B. "15" für AC).
     * Traversiert Geschwister-Elemente NACH dem Label, um das richtige data-value zu finden.
     * Notwendig weil AC und Initiative denselben Parent-Div teilen.
     */
    private static String attrValue(Document doc, String prefix, String labelText) {
        for (Element label : doc.select("." + prefix + "__attribute-label")) {
            if (label.text().trim().equalsIgnoreCase(labelText)) {
                Element sibling = label.nextElementSibling();
                while (sibling != null) {
                    if (sibling.hasClass(prefix + "__attribute-label")) break; // nächstes Label → stop
                    Element val = sibling.selectFirst("." + prefix + "__attribute-data-value");
                    if (val != null) return val.text().trim();
                    sibling = sibling.nextElementSibling();
                }
            }
        }
        return null;
    }

    /**
     * Gibt den Klammer-Zusatz eines Attribut-Felds zurück (z.B. "leather armor, shield" für AC).
     * Strips surrounding parentheses.
     */
    private static String attrExtra(Document doc, String prefix, String labelText) {
        for (Element label : doc.select("." + prefix + "__attribute-label")) {
            if (label.text().trim().equalsIgnoreCase(labelText)) {
                Element sibling = label.nextElementSibling();
                while (sibling != null) {
                    if (sibling.hasClass(prefix + "__attribute-label")) break;
                    Element extra = sibling.selectFirst("." + prefix + "__attribute-data-extra");
                    if (extra != null) return extra.text().trim().replaceAll("^\\(|\\)$", "");
                    sibling = sibling.nextElementSibling();
                }
            }
        }
        return null;
    }

    /**
     * Gibt den Wert eines Tidbit-Felds zurück (z.B. "Stealth +6" für Skills).
     */
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

    /**
     * Extrahiert Habitat-Daten aus dem appended environment-tags Block.
     * HTML-Struktur (außerhalb des Stat-Blocks, vom Crawler mitgespeichert):
     *   <p class="tags environment-tags">Habitat:
     *     <span class="tag environment-tag">Forest</span>...
     *   </p>
     */
    private static void parseHabitat(Document doc, Creature c) {
        for (Element tag : doc.select("span.environment-tag")) {
            String name = tag.text().trim();
            if (!name.isEmpty()) c.Biomes.add(name);
        }
    }

    // -------------------------------------------------------------------------
    // String-Normalisierung
    // -------------------------------------------------------------------------

    /** "CON +10, INT +12" → "CON:+10,INT:+12" */
    private static String normalizeSaves(String raw) {
        StringBuilder sb = new StringBuilder();
        Matcher m = SAVES_PATTERN.matcher(raw);
        while (m.find()) {
            if (sb.length() > 0) sb.append(',');
            sb.append(m.group(1)).append(':').append(m.group(2));
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    /** "Stealth +6, Perception +3" → "Stealth:+6,Perception:+3" */
    private static String normalizeSkills(String raw) {
        StringBuilder sb = new StringBuilder();
        Matcher m = SKILLS_PATTERN.matcher(raw);
        while (m.find()) {
            String skill = m.group(1).trim();
            if (skill.isBlank()) continue;
            if (sb.length() > 0) sb.append(',');
            sb.append(skill).append(':').append(m.group(2));
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    static int crToProficiencyBonus(String cr) {
        if (cr == null) return 2;
        double val = parseCr(cr);
        if (val <= 4)  return 2;
        if (val <= 8)  return 3;
        if (val <= 12) return 4;
        if (val <= 16) return 5;
        if (val <= 20) return 6;
        if (val <= 24) return 7;
        if (val <= 28) return 8;
        return 9;
    }

    static double parseCr(String cr) {
        if (cr == null || cr.isBlank()) return 0;
        if (cr.contains("/")) {
            String[] p = cr.split("/");
            return (double) parseInt(p[0], 0) / parseInt(p[1], 1);
        }
        try { return Double.parseDouble(cr.trim()); }
        catch (NumberFormatException e) { return 0; }
    }

    private static void splitImmunities(String raw, Creature c) {
        if (raw == null) return;
        if (raw.contains(";")) {
            String[] parts = raw.split(";", 2);
            c.DamageImmunities = parts[0].trim();
            if (c.ConditionImmunities == null) c.ConditionImmunities = parts[1].trim();
        } else {
            c.DamageImmunities = raw;
        }
    }

    /** D&D-korrekter Ability-Modifier: floor((score - 10) / 2). */
    static int abilityModifier(int score) {
        return Math.floorDiv(score - 10, 2);
    }

    private static int parseInt(String s, int def) {
        if (s == null) return def;
        s = PARSE_INT_STRIP.matcher(s.trim()).replaceAll("");
        // Klammern entfernen: "(22)" → "22"
        s = PARSE_INT_PARENS.matcher(s).replaceAll("");
        try { return Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return def; }
    }

    private static int parseIntNoComma(String s, int def) {
        if (s == null) return def;
        return parseInt(s.replace(",", ""), def);
    }

    private static String capitalizeFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }
}
