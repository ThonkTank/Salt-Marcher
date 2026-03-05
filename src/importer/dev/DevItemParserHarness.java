package importer.dev;

import entities.Item;
import importer.CrawlerHttpUtils;
import importer.HtmlItemParser;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.net.http.HttpClient;
import java.util.Properties;

/**
 * Validiert HtmlItemParser gegen live DnD Beyond Seiten.
 * Keine File-Ausgabe — reine In-Memory-Verifikation.
 *
 * No JavaFX dependency — compile and run without --module-path.
 *
 * Compile + Run:
 *   javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/importer/dev/DevItemParserHarness.java
 *   java  -cp "out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" importer.dev.DevItemParserHarness
 */
public class DevItemParserHarness {

    private static final String BASE_URL = "https://www.dndbeyond.com";

    public static void main(String[] args) throws Exception {
        Properties props = CrawlerHttpUtils.loadCrawlerProperties();
        String session = props.getProperty("cobalt.session", "").trim();
        if (session.isEmpty()) {
            System.err.println("cobalt.session fehlt in crawler.properties");
            System.exit(1);
        }
        long delayMs = CrawlerHttpUtils.parseDelayMs(props);

        // Test-Items: Mix aus Equipment-Typen und Magic Items
        String[][] items = {
            // {url-path, type}
            {"/equipment/4-longsword",               "equipment"},  // Waffe, Martial Melee
            {"/equipment/6-abacus",                   "equipment"},  // Adventuring Gear
            {"/equipment/16-chain-mail",              "equipment"},  // Rüstung, Heavy Armor
            {"/magic-items/9228356-bag-of-holding",   "magic"},      // Wondrous Item, kein Attunement
            {"/magic-items/5386-flame-tongue",        "magic"},      // Magic Weapon, Attunement
        };

        HttpClient http = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        int ok = 0;
        int fail = 0;

        for (String[] entry : items) {
            String path = entry[0];
            boolean isMagic = "magic".equals(entry[1]);

            System.out.println("=".repeat(70));
            System.out.println("URL: " + BASE_URL + path);

            String body;
            try {
                body = CrawlerHttpUtils.get(BASE_URL + path, http, session);
            } catch (Exception e) {
                System.err.println("  ÜBERSPRUNGEN: " + e.getMessage());
                fail++;
                continue;
            }
            System.out.println("HTTP: 200");

            Document doc = Jsoup.parse(body, BASE_URL);

            try {
                Item item = isMagic
                    ? HtmlItemParser.parseMagicItem(doc)
                    : HtmlItemParser.parseEquipment(doc);
                printItem(item);
                ok++;
            } catch (Exception e) {
                System.err.println("  PARSE ERROR: " + e.getMessage());
                e.printStackTrace(); // extra detail for manual debugging
                fail++;
            }

            Thread.sleep(delayMs);
        }

        System.out.println("=".repeat(70));
        System.out.printf("Result: %d OK, %d failed%n", ok, fail);
    }

    private static void printItem(Item i) {
        System.out.printf("Name:          %s%n", i.Name);
        System.out.printf("Category:      %s%n", i.Category);
        System.out.printf("Subcategory:   %s%n", i.Subcategory);
        System.out.printf("Magic:         %s%n", i.IsMagic);
        System.out.printf("Rarity:        %s%n", i.Rarity);
        System.out.printf("Attunement:    %s (%s)%n", i.RequiresAttunement, i.AttunementCondition);
        System.out.printf("Cost:          %s (%d cp)%n", i.Cost, i.CostCp);
        System.out.printf("Weight:        %.1f lb%n", i.Weight);
        System.out.printf("Damage:        %s%n", i.Damage);
        System.out.printf("Properties:    %s%n", i.Properties);
        System.out.printf("Armor Class:   %s%n", i.ArmorClass);
        System.out.printf("Source:        %s%n", i.Source);
        System.out.printf("Tags:          %s%n", i.Tags != null ? String.join(", ", i.Tags) : "");
        // 150 chars: item descriptions are longer than action descriptions (which use 80).
        System.out.printf("Description:   %s%n",
            i.Description != null && i.Description.length() > 150
                ? i.Description.substring(0, 150) + "..."
                : i.Description);
    }
}
