package features.creatures.parsing;

import features.creatures.parsing.input.ExtractStatBlockInput;
import features.creatures.parsing.input.ParseDocumentInput;
import features.creatures.parsing.task.ExtractStatBlockTask;
import features.creatures.parsing.task.ParseDocumentTask;

/**
 * Canonical creature-owned HTML/stat-block parsing seam for monster crawl and
 * import flows.
 */
@SuppressWarnings("unused")
public final class ParsingObject {

    public ParseDocumentInput.ParsedCreatureInput parseDocument(ParseDocumentInput input) {
        return ParseDocumentTask.parseDocument(input);
    }

    public ExtractStatBlockInput.ExtractedStatBlockInput extractStatBlock(ExtractStatBlockInput input) {
        return ExtractStatBlockTask.extractStatBlock(input);
    }
}
