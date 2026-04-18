package src.view.party.Model;

import org.jspecify.annotations.Nullable;

public final class PartyViewData {

    private PartyViewData() {
    }

    public enum MembershipSelection {
        ACTIVE,
        RESERVE
    }

    public enum RestSelection {
        SHORT_REST,
        LONG_REST
    }

    public enum RestIndicatorSeverity {
        NORMAL,
        SOON,
        OVERDUE
    }

    public record CharacterDraftInput(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
    }

    public record RestStatusViewData(
            String label,
            String tooltip,
            RestIndicatorSeverity severity
    ) {
    }

    public record PartyMemberViewData(
            Long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int xpToNextLevel,
            boolean readyToLevel,
            int passivePerception,
            int armorClass,
            int xpSinceShortRest,
            int xpSinceLongRest,
            int shortRestsTakenSinceLongRest,
            MembershipSelection membership,
            @Nullable RestStatusViewData restStatus
    ) {
    }
}
