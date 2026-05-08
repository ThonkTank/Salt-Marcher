package src.domain.party.published;

import src.domain.party.application.LoadAdventuringDaySummaryUseCase;

public final class RestCadenceUrgency {

    public static final RestCadenceUrgency NORMAL =
            new RestCadenceUrgency(LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.NORMAL);
    public static final RestCadenceUrgency SOON =
            new RestCadenceUrgency(LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.SOON);
    public static final RestCadenceUrgency OVERDUE =
            new RestCadenceUrgency(LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.OVERDUE);

    private final LoadAdventuringDaySummaryUseCase.RestCadenceUrgency urgency;

    private RestCadenceUrgency(LoadAdventuringDaySummaryUseCase.RestCadenceUrgency urgency) {
        this.urgency = urgency;
    }

    public static RestCadenceUrgency fromInternal(LoadAdventuringDaySummaryUseCase.RestCadenceUrgency urgency) {
        if (urgency == null) {
            return NORMAL;
        }
        return valueOf(urgency.name());
    }

    public LoadAdventuringDaySummaryUseCase.RestCadenceUrgency toInternal() {
        return urgency;
    }

    public String name() {
        return urgency.name();
    }

    public static RestCadenceUrgency valueOf(String value) {
        return switch (value) {
            case "SOON" -> SOON;
            case "OVERDUE" -> OVERDUE;
            case "NORMAL" -> NORMAL;
            default -> throw new IllegalArgumentException("Unknown RestCadenceUrgency: " + value);
        };
    }

    @Override
    public String toString() {
        return urgency.name();
    }
}
