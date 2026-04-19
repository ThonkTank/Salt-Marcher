package src.view.party.ViewModel;

import org.jspecify.annotations.Nullable;

public final class PartyViewData {

    private PartyViewData() {
    }

    public enum MembershipSelection {
        ACTIVE,
        RESERVE;

        public static MembershipSelection active() {
            return ACTIVE;
        }

        public static MembershipSelection reserve() {
            return RESERVE;
        }

        public boolean isActive() {
            return this == ACTIVE;
        }
    }

    public enum RestIndicatorSeverity {
        NORMAL,
        SOON,
        OVERDUE;

        static RestIndicatorSeverity normal() {
            return NORMAL;
        }

        static RestIndicatorSeverity soon() {
            return SOON;
        }

        static RestIndicatorSeverity overdue() {
            return OVERDUE;
        }
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
