package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;

public final class PartyRosterTopBarContentModel {

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
            List<MemberModel> reserveMembers,
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
            reserveMembers = filteredReserveMembers(allReserveMembers, reserveSearchText);
            summaryText = safe(summaryText);
            restSummaryText = safe(restSummaryText);
            actionStatus = safe(actionStatus);
        }

        static PanelContent loadingContent() {
            return new PanelContent(true, false, "", List.of(), List.of(), List.of(), "", "Lade...", "", "", false, true, true);
        }

        PanelContent withStatus(String status, boolean error) {
            return new PanelContent(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    allReserveMembers,
                    reserveMembers,
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
                    reserveMembers,
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
                    reserveMembers,
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
                    reserveMembers,
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
}
