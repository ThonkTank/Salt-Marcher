package importer;

import database.DatabaseManager;
import entities.Item;
import org.jsoup.Jsoup;
import repositories.ItemRepository;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class ItemImporter {

    public static void main(String[] args) throws Exception {
        Path equipmentDir  = Paths.get("data/items/equipment");
        Path magicItemsDir = Paths.get("data/items/magic-items");

        if (!Files.exists(equipmentDir) && !Files.exists(magicItemsDir)) {
            System.err.println("Verzeichnis nicht gefunden: data/items/");
            System.err.println("Bitte zuerst ItemCrawler ausführen.");
            System.exit(1);
        }

        System.out.println("Initialisiere Datenbank...");
        DatabaseManager.setupDatabase();

        // Alle HTML-Dateien aus beiden Verzeichnissen sammeln
        List<ImportEntry> entries = new ArrayList<>();
        collectFiles(equipmentDir, false, entries);
        collectFiles(magicItemsDir, true, entries);

        int total   = entries.size();
        int success = 0;
        int failed  = 0;

        System.out.println("Importiere " + total + " Items...");
        System.out.println();

        try (Connection conn = DatabaseManager.getConnection()) {
            try (Statement pragma = conn.createStatement()) {
                pragma.execute("PRAGMA journal_mode = WAL");
                pragma.execute("PRAGMA synchronous = NORMAL");
                pragma.execute("PRAGMA cache_size = -64000");
                System.out.println("PRAGMAs gesetzt: WAL, synchronous=OFF, cache_size=64MB");
            }

            conn.setAutoCommit(false);

            try (PreparedStatement itemPs = conn.prepareStatement(ItemRepository.ITEM_INSERT_SQL)) {

                for (int i = 0; i < total; i++) {
                    ImportEntry entry = entries.get(i);
                    String filename = entry.path.getFileName().toString();

                    try {
                        String html = Files.readString(entry.path);
                        Item item = entry.isMagic
                            ? HtmlItemParser.parseMagicItem(Jsoup.parse(html))
                            : HtmlItemParser.parseEquipment(Jsoup.parse(html));

                        item.Id = extractId(filename);
                        item.Slug = extractSlug(filename);
                        item.IsMagic = entry.isMagic;

                        if (item.Name == null || item.Name.isBlank()) {
                            throw new IllegalStateException("Kein Name gefunden");
                        }

                        ItemRepository.saveItemBatch(item, itemPs);
                        success++;

                        if ((i + 1) % 100 == 0) {
                            conn.commit();
                            System.out.printf("[%d/%d] %d OK, %d Fehler%n",
                                    i + 1, total, success, failed);
                        }

                    } catch (Exception e) {
                        failed++;
                        System.err.printf("FEHLER [%s]: %s%n", filename, e.getMessage());
                    }
                }

                conn.commit();
            }
        } catch (SQLException e) {
            System.err.println("Datenbank-Fehler beim Import: " + e.getMessage());
        }

        System.out.println();
        System.out.println("=== Import abgeschlossen ===");
        System.out.println("Erfolgreich: " + success);
        System.out.println("Fehlgeschlagen: " + failed);
        System.out.println("Gesamt: " + total);
    }

    private static void collectFiles(Path dir, boolean isMagic, List<ImportEntry> entries) {
        if (!Files.exists(dir)) return;
        try {
            Files.walk(dir, 1)
                    .filter(p -> p.toString().endsWith(".html"))
                    .sorted()
                    .forEach(p -> entries.add(new ImportEntry(p, isMagic)));
        } catch (Exception e) {
            System.err.println("Fehler beim Lesen von " + dir + ": " + e.getMessage());
        }
    }

    private static Long extractId(String filename) {
        return CrawlerUtils.extractIdFromFilename(filename);
    }

    private static String extractSlug(String filename) {
        return filename.replaceFirst("\\.html$", "");
    }

    private record ImportEntry(Path path, boolean isMagic) {}
}
