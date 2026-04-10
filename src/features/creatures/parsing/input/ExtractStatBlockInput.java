package features.creatures.parsing.input;

import org.jsoup.nodes.Document;

@SuppressWarnings("unused")
public record ExtractStatBlockInput(Document document) {

    public record ExtractedStatBlockInput(String html) {
    }
}
