package shared.crawler.config;

import shared.crawler.config.input.LoadRuntimeConfigInput;
import shared.crawler.config.input.ResolveProjectPathInput;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Properties;

/**
 * Canonical runtime-config seam for crawler entrypoints.
 * Keeps properties-file loading, session validation, and project-local path checks
 * in one shared place without owning HTTP client creation.
 */
@SuppressWarnings("unused")
public final class ConfigObject {

    public LoadRuntimeConfigInput.RuntimeConfigInput loadRuntimeConfig(LoadRuntimeConfigInput input)
            throws IOException, CrawlerConfigException {
        Properties properties = CrawlerProperties.loadCrawlerProperties();
        return new LoadRuntimeConfigInput.RuntimeConfigInput(
                properties,
                CrawlerProperties.parseCobaltSession(properties),
                CrawlerProperties.parseDelayMs(properties)
        );
    }

    public ResolveProjectPathInput.ProjectPathInput resolveProjectPath(ResolveProjectPathInput input) {
        Path path = CrawlerProperties.resolveProjectPath(input.configuredPath(), input.propertyName());
        return new ResolveProjectPathInput.ProjectPathInput(path);
    }
}
