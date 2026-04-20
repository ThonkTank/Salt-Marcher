package src.domain.party.published;

public record PartySummary(
        int activeCount,
        int reserveCount,
        int averageLevel
) {
}
