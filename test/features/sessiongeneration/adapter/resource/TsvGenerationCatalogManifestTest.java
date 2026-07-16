package features.sessiongeneration.adapter.resource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

final class TsvGenerationCatalogManifestTest {

    private static final String ARTIFACT_HASH =
            "10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6";
    private static final String SOURCE_HASH =
            "f87f6046444b7bf17814fae71c17802f4f875bfe4e4c9ec75574a1fc01a07621";
    private static final Pattern TABLE = Pattern.compile(
            "\\{\\s*\\\"columns\\\"\\s*:\\s*(\\d+)\\s*,\\s*"
                    + "\\\"file\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"\\s*,\\s*"
                    + "\\\"name\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"\\s*,\\s*"
                    + "\\\"rows\\\"\\s*:\\s*(\\d+)\\s*,\\s*"
                    + "\\\"sha256\\\"\\s*:\\s*\\\"([0-9a-f]{64})\\\"\\s*\\}",
            Pattern.DOTALL);

    @Test
    void snapshotPublishesCanonicalArtifactHashRatherThanSourceWorkbookHash() {
        var snapshot = new TsvGenerationCatalog().load();

        assertEquals(ARTIFACT_HASH, snapshot.contentHash());
        assertNotEquals(SOURCE_HASH, snapshot.contentHash());
    }

    @Test
    void manifestArtifactHashMismatchRejectsCatalogBeforeUse() {
        TsvGenerationCatalog catalog = new TsvGenerationCatalog(file -> {
            byte[] content = classpath().read(file);
            if (!file.equals("manifest.json")) return content;
            return new String(content, StandardCharsets.UTF_8)
                    .replace(ARTIFACT_HASH, "0".repeat(64)).getBytes(StandardCharsets.UTF_8);
        });

        assertThrows(IllegalStateException.class, catalog::load);
    }

    @Test
    void corruptMagicDecisionFamilyIsRejectedEvenWithMatchingArtifactHashes() {
        TsvGenerationCatalog catalog = mutatedCatalog("DB_MagicDecisionTypes.tsv",
                table -> table.replace("magic-decision:none\tnone\t", "magic-decision:none\tunknown\t"));

        assertThrows(IllegalStateException.class, catalog::load);
    }

    @Test
    void corruptLootSourceProvenanceIsRejectedEvenWithMatchingArtifactHashes() {
        TsvGenerationCatalog catalog = mutatedCatalog("DB_LootSources.tsv",
                table -> table.replace("\t2026-07-15", "\tnot-a-date"));

        assertThrows(IllegalStateException.class, catalog::load);
    }

    @Test
    void brokenRoleBandReferenceIsRejectedEvenWithMatchingArtifactHashes() {
        TsvGenerationCatalog catalog = mutatedCatalog("DB_EncounterRoleBands.tsv",
                table -> table.replaceFirst("\\tcr:m3\\t", "\tcr:missing\t"));

        assertThrows(IllegalStateException.class, catalog::load);
    }

    @Test
    void duplicateRequiredIdentityIsRejectedEvenWithMatchingArtifactHashes() {
        TsvGenerationCatalog catalog = mutatedCatalog("DB_LootSources.tsv",
                table -> table.replace("source:aaw-d100-marketplace\t", "source:reddit-d100-trade\t"));

        assertThrows(IllegalStateException.class, catalog::load);
    }

    private static TsvGenerationCatalog mutatedCatalog(String fileName, UnaryOperator<String> mutation) {
        TsvGenerationCatalog.ResourceLoader classpath = classpath();
        byte[] original = classpath.read(fileName);
        byte[] changed = mutation.apply(new String(original, StandardCharsets.UTF_8))
                .getBytes(StandardCharsets.UTF_8);
        String manifest = new String(classpath.read("manifest.json"), StandardCharsets.UTF_8)
                .replace(sha256(original), sha256(changed));
        String updatedManifest = manifest.replace(ARTIFACT_HASH, contentHash(manifest));
        return new TsvGenerationCatalog(file -> {
            if (file.equals("manifest.json")) return updatedManifest.getBytes(StandardCharsets.UTF_8);
            if (file.equals(fileName)) return changed;
            return classpath.read(file);
        });
    }

    private static TsvGenerationCatalog.ResourceLoader classpath() {
        return file -> {
            try (var input = TsvGenerationCatalogManifestTest.class.getClassLoader().getResourceAsStream(
                    "sessiongeneration/catalog-2026-07-16/" + file)) {
                if (input == null) throw new IllegalStateException("missing fixture resource " + file);
                return input.readAllBytes();
            } catch (java.io.IOException exception) {
                throw new IllegalStateException(exception);
            }
        };
    }

    private static String contentHash(String manifest) {
        List<TableEntry> tables = new ArrayList<>();
        Matcher matcher = TABLE.matcher(manifest);
        while (matcher.find()) {
            tables.add(new TableEntry(
                    matcher.group(2), matcher.group(3), Integer.parseInt(matcher.group(4)),
                    Integer.parseInt(matcher.group(1)), matcher.group(5)));
        }
        StringBuilder canonical = new StringBuilder("catalogVersion\tcatalog-2026-07-16\n");
        tables.stream().sorted(Comparator.comparing(TableEntry::file)).forEach(table -> canonical
                .append(table.file()).append('\t').append(table.name()).append('\t')
                .append(table.rows()).append('\t').append(table.columns()).append('\t')
                .append(table.sha256()).append('\n'));
        return sha256(canonical.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record TableEntry(String file, String name, int rows, int columns, String sha256) {
    }
}
