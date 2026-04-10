package features.spells.importer;

import importer.pipeline.PipelineObject;
import importer.pipeline.input.RunSpellImportInput;

import java.nio.file.Files;
import java.nio.file.Path;

public final class SpellImporter {

    private SpellImporter() {
        throw new AssertionError("No instances");
    }

    public static void main(String[] args) throws Exception {
        Path spellDir = Path.of("data", "spells");
        if (!Files.exists(spellDir)) {
            System.err.println("Directory not found: data/spells/");
            System.err.println("Run SpellCrawler first.");
            System.exit(1);
        }

        new PipelineObject().runSpellImport(new RunSpellImportInput(spellDir));
    }
}
