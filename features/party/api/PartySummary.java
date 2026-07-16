package features.party.api;

public record PartySummary(
        int activeCount,
        int reserveCount,
        int averageLevel
) {
}
