package shared.crawler.text.input;

@SuppressWarnings("unused")
public record NormalizeTextInput(
        String value,
        boolean blankToNull
) {

    public record NormalizedTextInput(String value) {
    }
}
