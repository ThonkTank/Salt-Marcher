package shared.crawler.slug.input;

import java.nio.file.Path;
import java.util.Set;
import java.util.regex.Pattern;

@SuppressWarnings("unused")
public record LoadSlugFileInput(
        Path slugFile,
        Pattern slugPattern,
        String invalidSlugLabel
) {

    public record LoadedSlugFileInput(
            Set<String> slugs,
            boolean filePresent
    ) {
    }
}
