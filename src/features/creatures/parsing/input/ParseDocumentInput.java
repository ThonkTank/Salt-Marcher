package features.creatures.parsing.input;

import org.jsoup.nodes.Document;

@SuppressWarnings("unused")
public record ParseDocumentInput(Document document) {

    public record ParsedCreatureInput(features.creatures.model.Creature creature) {
    }
}
