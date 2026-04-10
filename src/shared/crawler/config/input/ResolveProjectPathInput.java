package shared.crawler.config.input;

import java.nio.file.Path;

@SuppressWarnings("unused")
public record ResolveProjectPathInput(
        String configuredPath,
        String propertyName
) {

    public record ProjectPathInput(Path path) {
    }
}
