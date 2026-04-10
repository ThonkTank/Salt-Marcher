package importer.pipeline.input;

import java.nio.file.Path;

@SuppressWarnings("unused")
public record RunItemImportInput(
        Path equipmentDir,
        Path magicItemsDir
) {
}
