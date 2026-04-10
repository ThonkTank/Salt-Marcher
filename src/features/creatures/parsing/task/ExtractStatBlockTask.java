package features.creatures.parsing.task;

import features.creatures.parsing.input.ExtractStatBlockInput;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/**
 * Extracts the persisted monster stat-block fragment from a crawled D&D Beyond
 * detail page, including the out-of-block habitat tags consumed by creature
 * parsing.
 */
@SuppressWarnings("unused")
public final class ExtractStatBlockTask {

    private ExtractStatBlockTask() {
    }

    public static ExtractStatBlockInput.ExtractedStatBlockInput extractStatBlock(ExtractStatBlockInput input) {
        if (input == null || input.document() == null) {
            throw new IllegalArgumentException("input");
        }
        Element block = findStatBlock(input.document());
        if (block == null) {
            return new ExtractStatBlockInput.ExtractedStatBlockInput("");
        }

        StringBuilder html = new StringBuilder(block.outerHtml());
        Element envTags = input.document().selectFirst("p.environment-tags");
        if (envTags != null) {
            html.append("\n").append(envTags.outerHtml());
        }
        return new ExtractStatBlockInput.ExtractedStatBlockInput(html.toString());
    }

    private static Element findStatBlock(Document doc) {
        Element block = doc.selectFirst(".mon-stat-block-2024");
        if (block == null) block = doc.selectFirst(".mon-stat-block");
        if (block == null) block = doc.selectFirst(".stat-block-background");
        if (block == null) block = doc.selectFirst("[class*=stat-block]");
        return block;
    }
}
