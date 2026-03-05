package importer;

import entities.Creature;
import entities.ChallengeRating;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the HTML content of a D&D Beyond stat block (outerHtml of the .mon-stat-block element)
 * into a Creature object. Uses Jsoup CSS selectors instead of regex for all structured fields.
 *
 * Supports both formats:
 *   OLD (2014 MM): CSS prefix "mon-stat-block__"
 *   NEW (2024):    CSS prefix "mon-stat-block-2024__"
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
    // The character class includes both ASCII apostrophe (') and Unicode right single quote (')
    // to match skill names like "Thieves' Tools" as they appear on D&D Beyond.
    private static final Pattern SKILLS_PATTERN = Pattern.compile("([A-Za-z ()'']+?)\\s+([+-]\\d+)");
    // Old CR format: "14 (11,500 XP)" — CR and XP are embedded in one tidbit value.
    private static final Pattern CR_OLD_PATTERN = Pattern.compile("([\\d/]+)\\s*\\((\\d[\\d,]*)\\s*XP\\)");
    // New CR format: "14 (XP 11,500; PB +5)" — CR, XP, and PB each matched by separate patterns.
    private static final Pattern CR_NEW_PATTERN = Pattern.compile("^([\\d/]+)");
    private static final Pattern XP_NEW_PATTERN = Pattern.compile("XP\\s*([\\d,]+)");
    private static final Pattern PB_NEW_PATTERN = Pattern.compile("PB\\s+\\+?(\\d+)");
    private static final Pattern PB_PATTERN = Pattern.compile("\\+?(\\d+)");
    // Two sentence forms DnD Beyond uses for legendary action counts:
    //   "The goblin boss can take 3 legendary actions" (most common)
    //   "Uses: 3" (seen in some newer stat blocks)
    private static final Pattern LEGENDARY_COUNT_PATTERN = Pattern.compile(
            "(?i)(?:uses:\\s*(\\d+)|can take\\s+(\\d+)\\s+legendary)");
    // Strips "+" and "," before Integer.parseInt: "+4" -> "4", "11,500" -> "11500"
    // Removes + sign prefix and , thousand-separator before integer parsing.
    private static final Pattern PARSE_INT_NORMALIZE = Pattern.compile("[+,]");
    // Removes parentheses: "(22)" → "22" (HP expressions from old format)
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

        // true = 2024 Monster Manual format; false = 2014 format. Affects ability table
        // structure, save storage (embedded in ability table vs separate tidbit), initiative,
        // and attribute label names (e.g. "HP" vs "Hit Points").
        // Uses [class*=] (attribute substring) rather than .selectFirst(".mon-stat-block-2024")
        // because DnD Beyond renders compound class lists (e.g. "mon-stat-block-2024 mon-stat-block-2024--collapsed").
        // Jsoup's CSS class selector requires an exact token match, so the substring selector is required.
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
        if (c.ProficiencyBonus == 0 && c.CR != null) c.ProficiencyBonus = services.DndMath.proficiencyBonus(c.CR);
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
            String swarmSize = CrawlerHttpUtils.capitalizeFirst(swarmMatcher.group(1).trim());
            String baseType  = CrawlerHttpUtils.capitalizeFirst(singularize(swarmMatcher.group(2).trim()));
            c.CreatureType = baseType;
            c.Subtypes.clear();
            c.Subtypes.add("Swarm of " + swarmSize);
        } else {
            c.CreatureType = CrawlerHttpUtils.capitalizeFirst(typeRaw);
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
        return EACH_SIZE_PATTERN.matcher(raw).replaceAll(m -> CrawlerHttpUtils.capitalizeFirst(m.group(1)));
    }

    // Minimal singularizer for D&D creature type names in swarm entries (e.g. "beasts" → "beast",
    // "flies" → "fly"). Intentionally limited to rules that work for the known type vocabulary.
    // Not a general English singularizer — irregular plurals (wolves, mice, etc.) are not expected.
    private static String singularize(String plural) {
        if (plural == null || plural.isEmpty()) return plural;
        String lower = plural.toLowerCase();
        if (lower.endsWith("ies")) return plural.substring(0, plural.length() - 3) + "y";
        if (lower.endsWith("s") && !lower.endsWith("ss")) return plural.substring(0, plural.length() - 1);
        return plural;
    }

    // -------------------------------------------------------------------------
    // Attribute-Block: AC, HP, Speed, Initiative
    //
    // Attribute structure (both formats):
    //   <div class="mon-stat-block__attribute">
    //     <span class="mon-stat-block__attribute-label">Armor Class</span>
    //     <div class="mon-stat-block__attribute-data">
    //       <span class="mon-stat-block__attribute-data-value">15</span>
    //       <span class="mon-stat-block__attribute-data-extra">(natural armor)</span>
    //     </div>
    //   </div>
    // In the 2024 format, label names differ: "AC" instead of "Armor Class",
    // "HP" instead of "Hit Points". The 2024 format also adds an "Initiative" attribute.
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
        // New-format ability table has 4 columns: Abbrev | Score | Modifier | Save
        // Example row: STR | 18 | +4 | +7
        // Save is only stored when it differs from the raw ability modifier (proficiency bonus applies).
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
    //
    // Tidbit structure (both formats):
    //   <div class="mon-stat-block__tidbit">
    //     <span class="mon-stat-block__tidbit-label">Skills</span>
    //     <span class="mon-stat-block__tidbit-data">Stealth +6, Perception +3</span>
    //   </div>
    // "Tidbit" is a D&D Beyond term for the compact key/value rows below the ability scores.
    // Old (2014) and new (2024) formats use the same DOM structure but different label names.
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
                try {
                    c.CR = ChallengeRating.of(m.group(1).trim());
                } catch (IllegalArgumentException e) {
                    System.err.println("HtmlStatBlockParser.parse(): Invalid CR: " + e.getMessage());
                    c.CR = ChallengeRating.of("0");
                }
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

        // New format combines damage + condition immunities in one "Immunities" tidbit,
        // separated by ";". splitImmunities() handles the split.
        splitImmunities(tidbit(doc, prefix, "Immunities"), c);
        if (c.ConditionImmunities == null)
            c.ConditionImmunities = tidbit(doc, prefix, "Condition Immunities");

        // CR: "14 (XP 11,500, or 13,000 in lair; PB +5)"
        String crRaw = tidbit(doc, prefix, "CR");
        if (crRaw != null) {
            Matcher mCR = CR_NEW_PATTERN.matcher(crRaw);
            if (mCR.find()) {
                try {
                    c.CR = ChallengeRating.of(mCR.group(1).trim());
                } catch (IllegalArgumentException e) {
                    System.err.println("HtmlStatBlockParser.parse(): Invalid CR: " + e.getMessage());
                    c.CR = ChallengeRating.of("0");
                }
            }

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
    //
    // Section structure (both formats):
    //   <div class="mon-stat-block__description-block-heading">Actions</div>
    //   <p><strong>Multiattack.</strong> The goblin makes two attacks.</p>
    //   <p><strong>Scimitar.</strong> Melee Weapon Attack: +4 to hit, ...</p>
    //
    // Traits, Actions, Bonus Actions, Reactions, and Legendary Actions all share
    // the same DOM level — only the preceding heading div distinguishes which list
    // a <p> element belongs to. <h3> elements are NOT used; headings are always <div>s.
    // -------------------------------------------------------------------------

    private static void parseAllSections(Document doc, Creature c) {
        // inLegendaryActions tracks whether we are inside a Legendary Actions section,
        // because <p> elements for traits, actions, and legendary actions share the same DOM
        // level — only the preceding heading div distinguishes them.
        boolean inLegendaryActions = false;
        List<Creature.Action> currentList = c.Traits;

        // Sektions-Überschriften sind <div class="...__description-block-heading">, KEINE <h3>.
        // <p> elements carry action/trait entries (each starts with <strong>Name</strong>)
        // and also the legendary-action intro sentence (no <strong>, used only for count extraction).
        for (Element el : doc.select("div[class*=description-block-heading], p")) {
            if (el.tagName().equals("div")) {
                // Sektions-Überschrift
                String heading = el.text().trim().toLowerCase();
                switch (heading) {
                    case "actions":
                        inLegendaryActions = false;
                        currentList        = c.Actions;
                        break;
                    case "bonus actions":
                        inLegendaryActions = false;
                        currentList        = c.BonusActions;
                        break;
                    case "reactions":
                        inLegendaryActions = false;
                        currentList        = c.Reactions;
                        break;
                    case "legendary actions":
                        inLegendaryActions = true;
                        currentList        = c.LegendaryActions;
                        break;
                    // "traits", "lair actions", "regional effects" etc.: keine Änderung
                    default:
                        break;
                }
                continue;
            }

            // <p> Element
            Element strong = el.selectFirst("strong");
            if (strong == null) {
                // Intro-Satz der Legendary Actions: Count extrahieren
                if (inLegendaryActions && c.LegendaryActionCount == 0) {
                    Matcher m = LEGENDARY_COUNT_PATTERN.matcher(el.text());
                    if (m.find()) {
                        String g = m.group(1) != null ? m.group(1) : m.group(2);
                        c.LegendaryActionCount = parseInt(g, 3);
                    } else {
                        // D&D 5e default legendary action budget is 3.
                        // LEGENDARY_COUNT_PATTERN captures both common sentence forms:
                        //   "can take 3 legendary actions" and "Uses: 3"
                        c.LegendaryActionCount = 3;
                        System.err.println("HtmlStatBlockParser.parseAllSections(): "
                                + "Legendary action count not found for '" + c.Name + "', defaulting to 3");
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

            currentList.add(new Creature.Action(name, description));
        }
    }

    // -------------------------------------------------------------------------
    // Selektor-Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Shared helper: walks siblings after a matching attribute label and returns the text
     * of the first child element matching {@code fieldClass}. Stops at the next label element.
     */
    private static String attrField(Document doc, String prefix, String labelText, String fieldClass) {
        for (Element label : doc.select("." + prefix + "__attribute-label")) {
            if (!label.text().trim().equalsIgnoreCase(labelText)) continue;
            Element sibling = label.nextElementSibling();
            while (sibling != null) {
                if (sibling.hasClass(prefix + "__attribute-label")) break;
                Element val = sibling.selectFirst("." + prefix + fieldClass);
                if (val != null) return val.text().trim();
                sibling = sibling.nextElementSibling();
            }
        }
        return null;
    }

    /** Gibt den Wert eines Attribut-Felds zurück (z.B. "15" für AC). */
    private static String attrValue(Document doc, String prefix, String labelText) {
        return attrField(doc, prefix, labelText, "__attribute-data-value");
    }

    /** Gibt den Klammer-Zusatz eines Attribut-Felds zurück (z.B. "leather armor, shield" für AC). Strips surrounding parentheses. */
    private static String attrExtra(Document doc, String prefix, String labelText) {
        String raw = attrField(doc, prefix, labelText, "__attribute-data-extra");
        return raw != null ? raw.replaceAll("^\\(|\\)$", "") : null;
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

    private static void splitImmunities(String raw, Creature c) {
        if (raw == null) return;
        // In the 2024 stat-block format, the "Immunities" tidbit may combine both damage
        // and condition immunities in one field, separated by ";".
        // Example: "Fire, Cold; Charmed, Frightened"
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
        s = PARSE_INT_NORMALIZE.matcher(s.trim()).replaceAll("");
        // Klammern entfernen: "(22)" → "22"
        s = PARSE_INT_PARENS.matcher(s).replaceAll("");
        try { return Integer.parseInt(s.trim()); }
        catch (NumberFormatException e) { return def; }
    }

    private static int parseIntNoComma(String s, int def) {
        if (s == null) return def;
        return parseInt(s, def); // PARSE_INT_NORMALIZE already strips commas
    }

}
