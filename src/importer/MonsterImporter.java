package importer;

import database.DatabaseManager;
import entities.Creature;

import org.jsoup.Jsoup;
import repositories.CreatureRepository;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public class MonsterImporter {

    public static void main(String[] args) throws Exception {
        Path dataDir = Paths.get("data/monsters");

        if (!Files.exists(dataDir)) {
            System.err.println("Verzeichnis nicht gefunden: " + dataDir.toAbsolutePath());
            System.err.println("Bitte zuerst DndBeyondCrawler ausführen.");
            System.exit(1);
        }

        System.out.println("Initialisiere Datenbank...");
        DatabaseManager.setupDatabase();

        List<Path> files = Files.walk(dataDir, 1)
                .filter(p -> p.toString().endsWith(".html"))
                .sorted()
                .toList();

        int total   = files.size();
        int success = 0;
        int failed  = 0;

        System.out.println("Importiere " + total + " Monster...");
        System.out.println();

        try (Connection conn = DatabaseManager.getConnection()) {
            DatabaseManager.applyBulkImportPragmas(conn);
            System.out.println("PRAGMAs für Bulk-Import gesetzt: synchronous=NORMAL, cache_size=64MB");

            conn.setAutoCommit(false);

            String creatureSql = CreatureRepository.CREATURE_INSERT_SQL;
            String actionSql   = CreatureRepository.ACTION_INSERT_SQL;

            try (PreparedStatement creaturePs = conn.prepareStatement(creatureSql);
                 PreparedStatement actionPs   = conn.prepareStatement(actionSql)) {

                for (int i = 0; i < total; i++) {
                    Path file = files.get(i);
                    String filename = file.getFileName().toString();

                    try {
                        String html = Files.readString(file);
                        Creature creature = HtmlStatBlockParser.parse(Jsoup.parse(html));
                        creature.Id = extractId(filename);

                        if (creature.Name == null || creature.Name.isBlank()) {
                            throw new IllegalStateException("Kein Name gefunden");
                        }

                        CreatureRepository.saveCreatureBatch(creature, creaturePs, actionPs);
                        success++;

                        if ((i + 1) % 100 == 0) {
                            conn.commit();
                            System.out.printf("[%d/%d] %d OK, %d Fehler%n", i + 1, total, success, failed);
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

    private static Long extractId(String filename) {
        return CrawlerUtils.extractIdFromFilename(filename);
    }
}
