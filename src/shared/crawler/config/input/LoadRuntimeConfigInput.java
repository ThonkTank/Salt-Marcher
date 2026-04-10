package shared.crawler.config.input;

import java.util.Properties;

@SuppressWarnings("unused")
public record LoadRuntimeConfigInput() {

    public record RuntimeConfigInput(
            Properties properties,
            String cobaltSession,
            long delayMs
    ) {
    }
}
