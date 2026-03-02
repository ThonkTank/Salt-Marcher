package importer;

import entities.Item;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import importer.DndBeyondCrawler;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * Validiert HtmlItemParser gegen live DnD Beyond Seiten.
 * Keine File-Ausgabe — reine In-Memory-Verifikation.
 *
 * Compile + Run:
 *   javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/importer/ItemQuickTest.java
 *   java  -cp "out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" importer.ItemQuickTest
 */
public class ItemQuickTest {

    private static final String BASE = "https://www.dndbeyond.com";

    public static void main(String[] args) throws Exception {
        Properties props = new Properties();
        try (InputStream in = Files.newInputStream(Paths.get("crawler.properties"))) {
            props.load(in);
        }
        String session = props.getProperty("cobalt.session", "").trim();
        if (session.isEmpty()) {
            System.err.println("cobalt.session fehlt in crawler.properties");
            System.exit(1);
        }

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
            System.out.println("URL: " + BASE + path);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(BASE + path))
                    .header("User-Agent", DndBeyondCrawler.USER_AGENT)
                    .header("Cookie", "CobaltSession=" + session)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .GET()
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            System.out.println("HTTP: " + resp.statusCode());

            if (resp.statusCode() != 200) {
                System.err.println("  ÜBERSPRUNGEN (HTTP " + resp.statusCode() + ")");
                fail++;
                continue;
            }

            Document doc = Jsoup.parse(resp.body(), BASE);

            try {
                Item item = isMagic
                    ? HtmlItemParser.parseMagicItem(doc)
                    : HtmlItemParser.parseEquipment(doc);
                printItem(item);
                ok++;
            } catch (Exception e) {
                System.err.println("  PARSE FEHLER: " + e.getMessage());
                e.printStackTrace();
                fail++;
            }

            Thread.sleep(1500);
        }

        System.out.println("=".repeat(70));
        System.out.printf("Ergebnis: %d OK, %d Fehler%n", ok, fail);
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
        System.out.printf("Tags:          %s%n", i.Tags);
        System.out.printf("Description:   %s%n",
            i.Description != null && i.Description.length() > 150
                ? i.Description.substring(0, 150) + "..."
                : i.Description);
    }
}
