package shared.crawler.slug;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import shared.crawler.http.input.ComposeHttpInput;
import shared.crawler.slug.input.CollectListingSlugsInput;
import shared.crawler.slug.input.LoadSlugFileInput;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Canonical shared slug-discovery seam for crawler entrypoints.
 * It owns paginated listing scans and slug-file loading so individual crawlers
 * only keep feature-specific crawl orchestration and detail-page handling.
 */
@SuppressWarnings("unused")
public final class SlugObject {

    public CollectListingSlugsInput.ListingSlugsInput collectListingSlugs(CollectListingSlugsInput input)
            throws IOException, InterruptedException {
        Set<String> rawSlugs = new LinkedHashSet<>();
        int stablePages = 0;

        for (int page = 1; ; page++) {
            System.out.println("Loading " + input.listingSingularLabel() + " listing page " + page + "...");
            try {
                Set<String> pageSlugs = fetchListingPageSlugs(input, page);
                int sizeBefore = rawSlugs.size();
                rawSlugs.addAll(pageSlugs);
                int newlyAdded = rawSlugs.size() - sizeBefore;

                if (pageSlugs.isEmpty() || newlyAdded == 0) {
                    stablePages++;
                    if (stablePages >= input.maxConsecutiveStablePages()) {
                        System.out.println("No new " + input.listingPluralLabel() + " on page " + page
                                + " — listing complete.");
                        break;
                    }
                    continue;
                }

                stablePages = 0;
                System.out.println("  +" + newlyAdded + " new " + input.listingPluralLabel()
                        + " (total: " + rawSlugs.size() + ")");
            } catch (IOException e) {
                if (!input.tolerateFetchFailuresAsStablePages()) {
                    throw e;
                }
                stablePages++;
                System.err.println("SlugObject.collectListingSlugs() [" + input.listingPluralLabel()
                        + " page " + page + "]: " + e.getMessage());
                if (stablePages >= input.maxConsecutiveStablePages()) {
                    break;
                }
            }
        }

        return new CollectListingSlugsInput.ListingSlugsInput(SlugIdentity.deduplicateSlugs(rawSlugs));
    }

    public LoadSlugFileInput.LoadedSlugFileInput loadSlugFile(LoadSlugFileInput input) {
        if (!Files.exists(input.slugFile())) {
            return new LoadSlugFileInput.LoadedSlugFileInput(Set.of(), false);
        }

        Set<String> rawSlugs = new LinkedHashSet<>();
        try {
            for (String line : Files.readAllLines(input.slugFile(), StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                if (!input.slugPattern().matcher(trimmed).matches()) {
                    System.err.println("Skipping invalid " + input.invalidSlugLabel() + ": " + trimmed);
                    continue;
                }
                rawSlugs.add(trimmed);
            }
        } catch (IOException e) {
            System.err.println("SlugObject.loadSlugFile(): " + e.getMessage());
        }
        return new LoadSlugFileInput.LoadedSlugFileInput(SlugIdentity.deduplicateSlugs(rawSlugs), true);
    }

    private Set<String> fetchListingPageSlugs(CollectListingSlugsInput input, int page)
            throws IOException, InterruptedException {
        String url = input.listingUrlFormat().formatted(page);
        String html = input.crawlerHttp().fetchPageApi().fetchPage(new ComposeHttpInput.FetchPageInput(url));
        Document doc = Jsoup.parse(html, url);
        LinkedHashSet<String> slugSet = new LinkedHashSet<>();

        for (Element link : doc.select("a[href]")) {
            String href = link.attr("href");
            if (input.hrefPattern().matcher(href).matches()) {
                slugSet.add(href.substring(input.hrefPrefix().length()));
            }
        }
        return slugSet;
    }
}
