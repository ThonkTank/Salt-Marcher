package src.view.party.ViewModel;

import org.jspecify.annotations.Nullable;

public final class PartyViewData {

    private PartyViewData() {
    }

    public enum MembershipSelection {
        ACTIVE,
        RESERVE
    }

    public enum RestIndicatorSeverity {
        NORMAL,
        SOON,
        OVERDUE
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
