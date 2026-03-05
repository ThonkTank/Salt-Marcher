package importer;

import entities.Item;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parst den HTML-Inhalt einer D&D Beyond Item-Detailseite in ein Item-Objekt.
 * Unterstützt Equipment (/equipment/{id}-{slug}) und Magic Items (/magic-items/{id}-{slug}).
 *
 * Equipment-Struktur (Stand 2024/2025):
 *   <section class="primary-content">
 *     <div class="details-container details-container-equipment ...">
 *       <div class="details-container-content-description-text">
 *         Type: <span>Martial Melee Weapon</span> Cost: <span>15 GP</span> Weight: <span>3 lbs</span>
 *       </div>
 *       <table> ... (Weapons/Armor haben eine Stats-Tabelle) ... </table>
 *       <div class="tags"><div class="tag">Combat</div>...</div>
 *       <div class="source-description">Player's Handbook</div>
 *     </div>
 *   </section>
 *
 * Magic-Item-Struktur:
 *   <span>Wondrous Item, uncommon</span>
 *   <div class="more-info-content">
 *     <p>Description...</p>
 *   </div>
 *   <div class="source-description">Dungeon Master's Guide, pg. 234</div>
 *
 * <p>Unlike {@link HtmlStatBlockParser} which exposes a single {@code parse()} entry point
 * (internally auto-detecting the 2014/2024 stat block format), this parser exposes two methods
 * ({@link #parseEquipment} and {@link #parseMagicItem}) because the HTML structure of equipment
 * and magic item pages is too different to unify behind a single dispatcher.
 */
public class HtmlItemParser {

    // Pre-compiled Patterns
    private static final Pattern COST_PATTERN = Pattern.compile(
            "([\\d,]+)\\s*(cp|sp|ep|gp|pp)", Pattern.CASE_INSENSITIVE);
    private static final Pattern WEIGHT_PATTERN = Pattern.compile(
            "([\\d.]+)\\s*(?:lbs?\\.?|pound)", Pattern.CASE_INSENSITIVE);
    private static final Pattern RARITY_PATTERN = Pattern.compile(
            "(?i)\\b(common|uncommon|(?:very )?rare|legendary|artifact)\\b");
    private static final Pattern ATTUNEMENT_PATTERN = Pattern.compile(
            "\\(requires attunement(?:\\s+(.+?))?\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MAGIC_TYPE_PATTERN = Pattern.compile(
            "(?i)^\\s*(Wondrous Item|Potion|Ring|Rod|Staff|Wand|Scroll|Weapon|Armor)");

    // -------------------------------------------------------------------------
    // Content-Bereich finden (zentralisiert für Crawler, analog zu findStatBlock)
    // -------------------------------------------------------------------------

    public static Element findItemContent(Document doc) {
        // Magic Items: more-info-content hat nur die Beschreibung
        Element content = doc.selectFirst(".more-info-content");
        if (content != null) return content;
        // Equipment: details-container-content enthält Type/Cost/Weight, Description, Tags, Source
        // (ohne image-container und Lightbox-Scripts)
        content = doc.selectFirst(".details-container-content");
        if (content != null) return content;
        // Fallbacks
        content = doc.selectFirst(".primary-content");
        if (content == null) content = doc.selectFirst(".detail-content");
        if (content == null) content = doc.selectFirst("article");
        return content;
    }

    /**
     * Returns true if the given span text looks like a magic item type/rarity line
     * (e.g. "Wondrous Item, rare" or "Weapon (any sword), very rare").
     * Used by {@link ItemCrawler} to pre-capture the rarity span — shares the same
     * RARITY_PATTERN so both sides stay in sync.
     */
    static boolean isRaritySpan(String text) {
        return RARITY_PATTERN.matcher(text).find();
    }

    // -------------------------------------------------------------------------
    // Equipment parsen (/equipment/{id}-{slug})
    // -------------------------------------------------------------------------

    public static Item parseEquipment(Document doc) {
        Item item = new Item();
        item.IsMagic = false;
        item.Tags = new ArrayList<>();

        item.Name = extractName(doc);
        parseEquipmentMetaLine(doc, item);
        parseEquipmentTable(doc, item);
        parseEquipmentTags(doc, item);
        item.Source = extractSource(doc);
        item.Description = extractEquipmentDescription(doc);

        return item;
    }

    // -------------------------------------------------------------------------
    // Magic Item parsen (/magic-items/{id}-{slug})
    // -------------------------------------------------------------------------

    public static Item parseMagicItem(Document doc) {
        Item item = new Item();
        item.IsMagic = true;
        item.Tags = new ArrayList<>();

        item.Name = extractName(doc);
        parseMagicItemTypeLine(doc, item);
        parseMagicItemNotes(doc, item);
        item.Description = extractMagicItemDescription(doc);
        item.Source = extractSource(doc);

        return item;
    }

    // -------------------------------------------------------------------------
    // Name
    // -------------------------------------------------------------------------

    private static String extractName(Document doc) {
        // DnD Beyond hat <h1 class="page-title"> für den Item-Namen
        // (nicht zu verwechseln mit <h1 id="logo"> für das Site-Logo)
        Element h1 = doc.selectFirst("h1.page-title");
        if (h1 != null) return h1.text().trim();

        // Fallback: .page-heading
        Element heading = doc.selectFirst(".page-heading h1, .page-heading");
        if (heading != null) return heading.text().trim();

        // Fallback: Name aus der Stats-Tabelle (erste Zelle)
        Element table = doc.selectFirst("table tbody td:first-child");
        if (table != null) {
            String name = table.text().trim();
            if (!name.isEmpty() && !name.matches("\\d+.*")) return name;
        }

        // Fallback: Name aus dem Image-Alt-Text
        Element img = doc.selectFirst(".details-container .image");
        if (img != null) {
            String alt = img.attr("alt").trim();
            if (!alt.isEmpty()) return alt;
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // Equipment: Meta-Zeile "Type: <span>X</span> Cost: <span>Y</span> Weight: <span>Z</span>"
    // -------------------------------------------------------------------------

    private static void parseEquipmentMetaLine(Document doc, Item item) {
        // Die Meta-Zeile: <div class="details-container-content-description-text">
        //   Type: <span class="...-margined">Martial Melee Weapon</span>
        //   Cost: <span class="...-margined">15 GP</span>
        //   Weight: <span class="...">3 lbs</span>
        // </div>
        Element metaDiv = doc.selectFirst(".details-container-content-description-text");
        if (metaDiv == null) return;

        Elements spans = metaDiv.select("span");

        // Erster Span = Type, Zweiter = Cost, Dritter = Weight
        // Aber wir matchen lieber nach dem Kontext-Text
        String fullText = metaDiv.text();

        // Typ/Kategorie: Der erste <span> nach "Type:"
        for (int i = 0; i < spans.size(); i++) {
            Element span = spans.get(i);
            String val = span.text().trim();

            // Position im Parent-Text bestimmen
            String precedingText = getPrecedingText(metaDiv, span);

            if (precedingText.contains("Type:")) {
                categorizeEquipment(val, item);
            } else if (precedingText.contains("Cost:") && item.Cost == null) {
                item.Cost = val;
                item.CostCp = costToCp(val);
            } else if (precedingText.contains("Weight:") && item.Weight == 0.0) {
                item.Weight = parseWeight(val);
            } else if (precedingText.contains("AC:") || precedingText.contains("Armor Class:")) {
                item.ArmorClass = val;
            }
        }
    }

    /**
     * Gibt den Text-Inhalt des Parents zurück, der VOR dem gegebenen Element steht
     * (nur direkte TextNodes zwischen dem letzten vorherigen Span und dem Ziel-Element).
     * Nutzt Jsoup-Knotentraversal statt HTML-String-Suche.
     */
    private static String getPrecedingText(Element parent, Element child) {
        // Collect text nodes after the most recent preceding span.
        // Each new span resets the buffer so we only keep text from the nearest label context.
        StringBuilder sb = new StringBuilder();
        for (org.jsoup.nodes.Node node : parent.childNodes()) {
            if (node == child) break;
            if (node instanceof Element && ((Element) node).tagName().equals("span")) {
                // Neuer Span-Vorgänger — Text davor verwerfen, frisch sammeln
                sb.setLength(0);
            } else if (node instanceof org.jsoup.nodes.TextNode) {
                sb.append(((org.jsoup.nodes.TextNode) node).text());
            }
        }
        return sb.toString();
    }

    private static void categorizeEquipment(String typeText, Item item) {
        String lower = typeText.toLowerCase();
        if (lower.contains("weapon")) {
            item.Category = "Weapon";
            item.Subcategory = typeText.replaceAll("(?i)\\s*weapon\\s*", "").trim();
            if (item.Subcategory.isEmpty()) item.Subcategory = null;
        } else if (lower.contains("armor") || lower.contains("shield")) {
            item.Category = "Armor";
            item.Subcategory = typeText;
        } else if (lower.contains("tool") || lower.contains("kit") || lower.contains("supplies")) {
            item.Category = "Tool";
            item.Subcategory = typeText;
        } else {
            item.Category = "Adventuring Gear";
            item.Subcategory = typeText;
        }
    }

    // -------------------------------------------------------------------------
    // Equipment: Stats-Tabelle parsen
    // -------------------------------------------------------------------------

    private static void parseEquipmentTable(Document doc, Item item) {
        Element table = doc.selectFirst("table");
        if (table == null) return;

        Elements headers = table.select("thead th");
        if (headers.isEmpty()) headers = table.select("tr:first-child th");
        if (headers.isEmpty()) return;

        String[] colNames = new String[headers.size()];
        for (int i = 0; i < headers.size(); i++) {
            colNames[i] = headers.get(i).text().trim().toLowerCase();
        }

        Elements rows = table.select("tbody tr");
        if (rows.isEmpty()) return;

        // Erste Daten-Zeile verwenden
        Element row = rows.first();
        Elements cells = row.select("td");
        for (int i = 0; i < Math.min(cells.size(), colNames.length); i++) {
            String val = cells.get(i).text().trim();
            if (val.isEmpty() || val.equals("—") || val.equals("-")) continue;

            switch (colNames[i]) {
                case "cost":
                    // Nur setzen wenn nicht schon aus Meta-Zeile
                    if (item.Cost == null) {
                        item.Cost = val;
                        item.CostCp = costToCp(val);
                    }
                    break;
                case "damage":
                    item.Damage = val;
                    break;
                case "weight":
                    if (item.Weight == 0.0) item.Weight = parseWeight(val);
                    break;
                case "properties":
                    item.Properties = val;
                    break;
                case "armor class":
                case "armor class (ac)":
                case "ac":
                    item.ArmorClass = val;
                    break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Equipment: Tags
    // -------------------------------------------------------------------------

    private static void parseEquipmentTags(Document doc, Item item) {
        // <div class="tags"><div class="tag">Combat</div><div class="tag">Damage</div></div>
        for (Element tag : doc.select("div.tags div.tag")) {
            String t = tag.text().trim();
            if (!t.isEmpty() && !t.equalsIgnoreCase("Tags:")) item.Tags.add(t);
        }
    }

    // -------------------------------------------------------------------------
    // Magic Item: Typ/Rarity/Attunement-Zeile
    // -------------------------------------------------------------------------

    private static void parseMagicItemTypeLine(Document doc, Item item) {
        // Die Typ-Zeile steht in einem <span> außerhalb von .more-info-content
        // Format: "Wondrous Item, uncommon" oder "Weapon (any sword), rare (requires attunement)"
        // Strategie 1 (bevorzugt): Rarity + Typ-Keyword; Strategie 2 (Fallback): nur Rarity
        // (z.B. "Tattoo, uncommon", "Figurine of Wondrous Power, rare")

        String typeLine = null;
        String rarityOnlyLine = null;

        // Anchor the search to the h1.page-title parent (header area) to avoid false matches
        // from navigation or sidebar spans on full live pages. Saved HTML fragments are minimal
        // so the fallback to doc.select("span") is only a safety net for missing h1.
        Element h1 = doc.selectFirst("h1.page-title");
        Elements spans = h1 != null ? h1.parent().select("span") : doc.select("span");

        for (Element span : spans) {
            String text = span.text().trim();
            if (text.isEmpty() || text.length() > 200) continue;
            if (!RARITY_PATTERN.matcher(text).find()) continue;
            if (MAGIC_TYPE_PATTERN.matcher(text).find()) {
                typeLine = text;
                break; // best match, done
            }
            if (rarityOnlyLine == null) rarityOnlyLine = text; // keep first fallback
        }

        if (typeLine == null) typeLine = rarityOnlyLine;
        if (typeLine == null) return;

        // Typ extrahieren
        Matcher typeMatcher = MAGIC_TYPE_PATTERN.matcher(typeLine);
        if (typeMatcher.find()) {
            item.Category = typeMatcher.group(1).trim();
        }

        // Rarity extrahieren
        Matcher rarityMatcher = RARITY_PATTERN.matcher(typeLine);
        if (rarityMatcher.find()) {
            item.Rarity = CrawlerHttpUtils.toTitleCase(rarityMatcher.group(1));
        }

        // Attunement extrahieren
        Matcher attMatcher = ATTUNEMENT_PATTERN.matcher(typeLine);
        if (attMatcher.find()) {
            item.RequiresAttunement = true;
            item.AttunementCondition = attMatcher.group(1);
        }
    }

    // -------------------------------------------------------------------------
    // Magic Item: Notes-String (Tags, Source bei Legacy-Items)
    // -------------------------------------------------------------------------

    private static void parseMagicItemNotes(Document doc, Item item) {
        // Legacy Magic Items: <p class="notes-string">Notes: Damage: Fire, Damage, Combat, Versatile, Sap</p>
        Element notes = doc.selectFirst("p.notes-string");
        if (notes == null) return;

        String text = notes.text().trim();
        // "Notes: Damage: Fire, Damage, Combat, Versatile, Sap" → nach "Notes:" alles als Tags
        if (text.startsWith("Notes:")) {
            text = text.substring("Notes:".length()).trim();
        }
        if (!text.isEmpty() && item.Tags.isEmpty()) {
            for (String tag : text.split(",")) {
                String trimmed = tag.trim();
                if (!trimmed.isEmpty()) item.Tags.add(trimmed);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Beschreibung
    // -------------------------------------------------------------------------

    private static String extractEquipmentDescription(Document doc) {
        // Description ist in <p>-Tags innerhalb .details-container-content-description-text
        // (die zweite .details-container-content-description-text div enthält die Beschreibung)
        Elements descDivs = doc.select(".details-container-content-description-text");
        StringBuilder sb = new StringBuilder();

        for (Element div : descDivs) {
            for (Element p : div.select("p")) {
                String text = p.text().trim();
                if (text.isEmpty()) continue;
                if (sb.length() > 0) sb.append("\n");
                sb.append(text);
            }
        }

        if (sb.length() > 0) return sb.toString();

        // Fallback: Alle <p> in primary-content
        Element content = doc.selectFirst(".primary-content");
        if (content != null) {
            for (Element p : content.select("p")) {
                String text = p.text().trim();
                if (text.isEmpty()) continue;
                if (sb.length() > 0) sb.append("\n");
                sb.append(text);
            }
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static String extractMagicItemDescription(Document doc) {
        // Magic Items: Beschreibung in <div class="more-info-content"> > <p>
        Element content = doc.selectFirst(".more-info-content");
        if (content == null) return null;

        StringBuilder sb = new StringBuilder();
        for (Element p : content.select("p")) {
            String text = p.text().trim();
            if (text.isEmpty()) continue;
            if (sb.length() > 0) sb.append("\n");
            sb.append(text);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    // -------------------------------------------------------------------------
    // Source
    // -------------------------------------------------------------------------

    private static String extractSource(Document doc) {
        // <div class="source-description">D&D Beyond Basic Rules</div>
        Element source = doc.selectFirst(".source-description");
        if (source != null) {
            String text = source.text().trim();
            if (!text.isEmpty()) return text;
        }

        // Fallback: Suche nach "Source:" Label
        for (Element el : doc.select("p, span, div")) {
            String text = el.ownText().trim();
            if (text.startsWith("Source:")) {
                return text.substring("Source:".length()).trim();
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Cost conversion
    // -------------------------------------------------------------------------

    /** "15 gp" → 1500 cp, "5 sp" → 50 cp. Returns 0 for unknown format. Clamps to Integer.MAX_VALUE on overflow. */
    static int costToCp(String costStr) {
        if (costStr == null) return 0;
        Matcher m = COST_PATTERN.matcher(costStr);
        if (!m.find()) return 0;
        long amount;
        try { amount = Long.parseLong(m.group(1).replace(",", "")); }
        catch (NumberFormatException e) { return 0; }
        long multiplier = switch (m.group(2).toLowerCase()) {
            case "cp" -> 1L; case "sp" -> 10L; case "ep" -> 50L;
            case "gp" -> 100L; case "pp" -> 1000L; default -> 0L;
        };
        long result = amount * multiplier;
        return result > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) result;
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    private static double parseWeight(String s) {
        if (s == null) return 0.0;
        Matcher m = WEIGHT_PATTERN.matcher(s);
        if (m.find()) {
            try { return Double.parseDouble(m.group(1)); }
            catch (NumberFormatException e) { return 0.0; }
        }
        try { return Double.parseDouble(s.replace(",", "").trim()); }
        catch (NumberFormatException e) { return 0.0; }
    }

}
