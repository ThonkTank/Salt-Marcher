package importer.pipeline.input;

import java.nio.file.Path;

@SuppressWarnings("unused")
public record RunSpellImportInput(
        Path spellDir
) {
}
