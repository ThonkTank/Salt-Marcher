package src.domain.party.published;

import src.domain.party.application.CalculateAdventuringDayUseCase;

public final class AdventuringDayProgressEvent {

    private final CalculateAdventuringDayUseCase.ProgressEvent event;

    public AdventuringDayProgressEvent(
            int groupXp,
            AdventuringDayProgressEventType type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay
    ) {
        this(new CalculateAdventuringDayUseCase.ProgressEvent(
                groupXp,
                type == null
                        ? CalculateAdventuringDayUseCase.ProgressEventType.LONG_REST
                        : type.toInternal(),
                dayNumber,
                newLevel,
                affectedCharacters,
                partialDay));
    }

    public AdventuringDayProgressEvent(CalculateAdventuringDayUseCase.ProgressEvent event) {
        this.event = event == null
                ? new CalculateAdventuringDayUseCase.ProgressEvent(
                        0,
                        CalculateAdventuringDayUseCase.ProgressEventType.LONG_REST,
                        0,
                        0,
                        0,
                        false)
                : event;
    }

    public static AdventuringDayProgressEvent fromInternal(CalculateAdventuringDayUseCase.ProgressEvent event) {
        return new AdventuringDayProgressEvent(event);
    }

    public CalculateAdventuringDayUseCase.ProgressEvent toInternal() {
        return event;
    }

    public int groupXp() {
        return event.groupXp();
    }

    public AdventuringDayProgressEventType type() {
        return AdventuringDayProgressEventType.fromInternal(event.type());
    }

    public int dayNumber() {
        return event.dayNumber();
    }

    public int newLevel() {
        return event.newLevel();
    }

    public int affectedCharacters() {
        return event.affectedCharacters();
    }

    public boolean partialDay() {
        return event.partialDay();
    }
}
