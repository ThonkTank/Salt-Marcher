package shared.crawler.slug.input;

import shared.crawler.http.input.ComposeHttpInput;

import java.util.Set;
import java.util.regex.Pattern;

@SuppressWarnings("unused")
public record CollectListingSlugsInput(
        ComposeHttpInput.CrawlerHttpInput crawlerHttp,
        String listingUrlFormat,
        String listingSingularLabel,
        String listingPluralLabel,
        String hrefPrefix,
        Pattern hrefPattern,
        int maxConsecutiveStablePages,
        boolean tolerateFetchFailuresAsStablePages
) {

    public record ListingSlugsInput(Set<String> slugs) {
    }
}
