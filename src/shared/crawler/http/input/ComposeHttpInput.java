package shared.crawler.http.input;

import shared.crawler.config.input.LoadRuntimeConfigInput;

import java.io.IOException;

@SuppressWarnings("unused")
public record ComposeHttpInput(
        LoadRuntimeConfigInput.RuntimeConfigInput runtimeConfig
) {

    public record FetchPageInput(String url) {
    }

    @FunctionalInterface
    public interface FetchPageApi {
        String fetchPage(FetchPageInput input) throws IOException, InterruptedException;
    }

    public record CrawlerHttpInput(
            long delayMs,
            FetchPageApi fetchPageApi
    ) {
    }
}
