package features.creatures.catalog.input;

@SuppressWarnings("unused")
public record CountAllInput() {

    public record CountedAllInput(boolean success, int totalCount) {
    }
}
