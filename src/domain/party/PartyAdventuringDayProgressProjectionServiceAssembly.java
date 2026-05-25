package src.domain.party;

import src.domain.party.model.roster.model.PartyAdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;

final class PartyAdventuringDayProgressProjectionServiceAssembly {

    private PartyAdventuringDayProgressProjectionServiceAssembly() {
    }

    static src.domain.party.published.AdventuringDayLevelProgress mapLevelProgress(
            src.domain.party.model.roster.model.PartyAdventuringDayLevelProgress progress
    ) {
        return new src.domain.party.published.AdventuringDayLevelProgress(
                progress.startLevel(),
                progress.endLevel(),
                progress.characterCount(),
                progress.levelUps());
    }

    static AdventuringDayProgressEvent mapProgressEvent(PartyAdventuringDayProgressEvent event) {
        return new AdventuringDayProgressEvent(
                event.groupXp(),
                toPublishedProgressEventType(event),
                event.dayNumber(),
                event.newLevel(),
                event.affectedCharacters(),
                event.partialDay());
    }

    private static AdventuringDayProgressEventType toPublishedProgressEventType(
            PartyAdventuringDayProgressEvent event
    ) {
        if (event.isLevelUp()) {
            return AdventuringDayProgressEventType.LEVEL_UP;
        }
        if (event.isShortRest()) {
            return AdventuringDayProgressEventType.SHORT_REST;
        }
        return AdventuringDayProgressEventType.LONG_REST;
    }
}
