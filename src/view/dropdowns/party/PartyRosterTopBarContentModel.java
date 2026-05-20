package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;

public final class PartyRosterTopBarContentModel {

    private static final int MAX_CHARACTER_LEVEL = 20;
    private static final long NO_MEMBER_ID = 0L;

    private final ReadOnlyObjectWrapper<PanelContent> panelContent =
            new ReadOnlyObjectWrapper<>(PanelContent.loadingContent());

    public ReadOnlyObjectProperty<PanelContent> panelContentProperty() {
        return panelContent.getReadOnlyProperty();
    }

    void showPanel(PanelContent content) {
        panelContent.set(content == null ? PanelContent.loadingContent() : content);
    }

    void showPending(String status) {
        showPanel(currentPanel().withPending(status));
    }

    void showStatus(String status, boolean error) {
        showPanel(currentPanel().withStatus(status, error));
    }

    void showReadyStatus(String status, boolean error) {
        showPanel(currentPanel().withReadyStatus(status, error));
    }

    void showReserveSearch(String searchText) {
        showPanel(currentPanel().withReserveSearch(searchText));
    }

    String reserveSearchText() {
        return currentPanel().reserveSearchText();
    }

    @Nullable MemberModel findMember(long memberId) {
        if (memberId <= NO_MEMBER_ID) {
            return null;
        }
        for (MemberModel member : currentPanel().activeMembers()) {
            if (member.id() != null && member.id() == memberId) {
                return member;
            }
        }
        for (MemberModel member : currentPanel().reserveMembers()) {
            if (member.id() != null && member.id() == memberId) {
                return member;
            }
        }
        return null;
    }

    String memberName(long memberId) {
        @Nullable MemberModel member = findMember(memberId);
        return member == null ? "" : member.name();
    }

    static MemberModel memberModel(
            @Nullable PartyMemberDetails member,
            @Nullable RestCadenceStatus restStatus
    ) {
        if (member == null) {
            return emptyMemberModel(restStatus);
        }
        PartyMemberDetails safeMember = member;
        String restText = safe(restStatusText(restStatus));
        LevelProgressDisplay levelProgress = levelProgressDisplay(safeMember);
        return new MemberModel(
                safeMember.id(),
                safe(safeMember.name()),
                safe(safeMember.playerName()),
                safeMember.level(),
                safeMember.passivePerception(),
                safeMember.armorClass(),
                identityText(safeMember),
                combatText(safeMember),
                "Lv " + safeMember.level(),
                levelProgress.nextLevelLabel(),
                levelProgress.text(),
                restText,
                restUrgencyStyleClass(restStatus));
    }

    private static MemberModel emptyMemberModel(@Nullable RestCadenceStatus restStatus) {
        return new MemberModel(
                0L,
                "",
                "",
                1,
                10,
                10,
                "",
                "AC 10 | PP 10",
                "Lv 1",
                "Lv 2",
                formatProgressText(0, 300, 0),
                safe(restStatusText(restStatus)),
                restUrgencyStyleClass(restStatus));
    }

    private PanelContent currentPanel() {
        PanelContent current = panelContent.get();
        return current == null ? PanelContent.loadingContent() : current;
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    public record PanelContent(
            boolean loading,
            boolean storageError,
            String storageMessage,
            List<MemberModel> activeMembers,
            List<MemberModel> allReserveMembers,
            String reserveSearchText,
            String summaryText,
            String restSummaryText,
            String actionStatus,
            boolean actionStatusError,
            boolean restActionsDisabled,
            boolean actionsDisabled
    ) {

        public PanelContent {
            storageMessage = safe(storageMessage);
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            allReserveMembers = allReserveMembers == null ? List.of() : List.copyOf(allReserveMembers);
            reserveSearchText = safe(reserveSearchText);
            summaryText = safe(summaryText);
            restSummaryText = safe(restSummaryText);
            actionStatus = safe(actionStatus);
        }

        static PanelContent loadingContent() {
            return new PanelContent(true, false, "", List.of(), List.of(), "", "Lade...", "", "", false, true, true);
        }

        public List<MemberModel> reserveMembers() {
            return filteredReserveMembers(allReserveMembers, reserveSearchText);
        }

        PanelContent withStatus(String status, boolean error) {
            return new PanelContent(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    allReserveMembers,
                    reserveSearchText,
                    summaryText,
                    restSummaryText,
                    status,
                    error,
                    restActionsDisabled,
                    actionsDisabled);
        }

        PanelContent withReadyStatus(String status, boolean error) {
            return new PanelContent(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    allReserveMembers,
                    reserveSearchText,
                    summaryText,
                    restSummaryText,
                    status,
                    error,
                    activeMembers.isEmpty(),
                    false);
        }

        PanelContent withPending(String status) {
            return new PanelContent(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    allReserveMembers,
                    reserveSearchText,
                    summaryText,
                    restSummaryText,
                    status,
                    false,
                    true,
                    true);
        }

        PanelContent withReserveSearch(String searchText) {
            return new PanelContent(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    allReserveMembers,
                    searchText,
                    summaryText,
                    restSummaryText,
                    actionStatus,
                    actionStatusError,
                    restActionsDisabled,
                    actionsDisabled);
        }

        private static List<MemberModel> filteredReserveMembers(List<MemberModel> members, String searchText) {
            String lowerSearch = safe(searchText).trim().toLowerCase(Locale.ROOT);
            if (lowerSearch.isBlank()) {
                return List.copyOf(members);
            }
            return members.stream()
                    .filter(member -> member.name().toLowerCase(Locale.ROOT).contains(lowerSearch))
                    .toList();
        }
    }

    private record LevelProgressDisplay(String nextLevelLabel, String text) {
    }

    public record MemberModel(
            @Nullable Long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            String identityText,
            String combatText,
            String levelLabel,
            String nextLevelLabel,
            String levelProgressText,
            String restText,
            String restStyleClass
    ) {

        public MemberModel {
            name = safe(name);
            playerName = safe(playerName);
            identityText = safe(identityText);
            combatText = safe(combatText);
            levelLabel = safe(levelLabel);
            nextLevelLabel = safe(nextLevelLabel);
            levelProgressText = safe(levelProgressText);
            restText = safe(restText);
            restStyleClass = safe(restStyleClass);
        }
    }

    private static String identityText(PartyMemberDetails member) {
        String name = safe(member.name()).trim();
        String player = safe(member.playerName()).trim();
        if (player.isBlank()) {
            return name;
        }
        if (name.isBlank()) {
            return player;
        }
        return name + " - " + player;
    }

    private static String combatText(PartyMemberDetails member) {
        return "AC " + member.armorClass() + " | PP " + member.passivePerception();
    }

    private static LevelProgressDisplay levelProgressDisplay(PartyMemberDetails member) {
        int currentXp = Math.max(0, member.currentXp());
        int currentLevelXp = Math.max(0, member.currentLevelXp());
        int nextLevelXp = Math.max(currentLevelXp, member.nextLevelXp());
        if (member.level() >= MAX_CHARACTER_LEVEL || nextLevelXp <= currentLevelXp) {
            return new LevelProgressDisplay("Max", formatProgressText(currentXp, currentXp, 100));
        }
        int span = Math.max(1, nextLevelXp - currentLevelXp);
        int earnedInLevel = Math.max(0, currentXp - currentLevelXp);
        double fraction = Math.max(0.0, Math.min(1.0, (double) earnedInLevel / span));
        int percent = (int) Math.round(fraction * 100.0);
        if (member.readyToLevel()) {
            percent = 100;
        }
        return new LevelProgressDisplay(
                "Lv " + (member.level() + 1),
                formatProgressText(currentXp, nextLevelXp, percent));
    }

    private static String formatProgressText(int currentXp, int targetXp, int percent) {
        return currentXp + "/" + Math.max(0, targetXp) + " XP (" + Math.max(0, Math.min(100, percent)) + "%)";
    }

    private static String restStatusText(@Nullable RestCadenceStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status.nextMilestone()) {
            case SHORT_REST_ONE -> "Short Rest 1";
            case SHORT_REST_TWO -> "Short Rest 2";
            case LONG_REST -> "Long Rest";
        } + ": " + status.xpDelta() + " XP";
    }

    private static String restUrgencyStyleClass(@Nullable RestCadenceStatus status) {
        if (status == null) {
            return "";
        }
        RestCadenceUrgency urgency = status.urgency();
        if (urgency == RestCadenceUrgency.OVERDUE) {
            return "party-rest-chip-overdue";
        }
        if (urgency == RestCadenceUrgency.SOON) {
            return "party-rest-chip-soon";
        }
        return "party-rest-chip-normal";
    }
}
