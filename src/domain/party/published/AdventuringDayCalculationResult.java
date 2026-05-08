package src.domain.party.published;

public record AdventuringDayCalculationResult(
        ReadStatus status,
        AdventuringDayCalculation calculation,
        AdventuringDayPlanningSummary planningSummary
) {
    public AdventuringDayCalculationResult {
        status = status == null ? ReadStatus.STORAGE_ERROR : status;
        planningSummary = planningSummary == null ? AdventuringDayPlanningSummary.empty() : planningSummary;
    }
}
