package src.domain.party.published;

import src.domain.party.application.CalculateAdventuringDayUseCase;

public enum AdventuringDayProgressEventType {
    LEVEL_UP,
    SHORT_REST,
    LONG_REST;

    public static AdventuringDayProgressEventType fromInternal(CalculateAdventuringDayUseCase.ProgressEventType type) {
        if (type == null) {
            return LONG_REST;
        }
        return AdventuringDayProgressEventType.valueOf(type.name());
    }

    public CalculateAdventuringDayUseCase.ProgressEventType toInternal() {
        return switch (this) {
            case LEVEL_UP -> CalculateAdventuringDayUseCase.ProgressEventType.LEVEL_UP;
            case SHORT_REST -> CalculateAdventuringDayUseCase.ProgressEventType.SHORT_REST;
            case LONG_REST -> CalculateAdventuringDayUseCase.ProgressEventType.LONG_REST;
        };
    }
}
