package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.Locale;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.ReadStatus;

final class AdventuringDayTopBarViewModel {

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.GERMANY);

    private final PartyApplicationService party;
    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Rastbudget \u25be");
    private final ReadOnlyObjectWrapper<PanelModel> panel = new ReadOnlyObjectWrapper<>(PanelModel.loadingModel());

    AdventuringDayTopBarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    void refresh() {
        panel.set(PanelModel.loadingModel());
        AdventuringDayResult result = party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            triggerText.set("Rastbudget nicht verf\u00fcgbar \u25be");
            panel.set(PanelModel.error("Rastbudget konnte nicht geladen werden."));
            return;
        }
        applySummary(result.summary());
    }

    private void applySummary(@Nullable AdventuringDaySummary summary) {
        if (summary == null || summary.activePartyLevels().isEmpty()) {
            triggerText.set("Kein Rastbudget \u25be");
            panel.set(PanelModel.empty("Keine aktive Party f\u00fcr das Rastbudget."));
            return;
        }
        triggerText.set("SR " + format(summary.remainingToShortRest())
                + " \u00b7 LR " + format(summary.remainingToLongRest()) + " \u25be");
        panel.set(new PanelModel(
                false,
                false,
                false,
                "Short Rest in " + format(summary.remainingToShortRest()) + " XP",
                "Long Rest in " + format(summary.remainingToLongRest()) + " XP",
                format(summary.consumedXp()) + " / " + format(summary.totalBudgetXp())
                        + " XP · " + summary.consumedPercent() + "% Tagesbudget",
                ""));
    }

    private static String format(int value) {
        return INTEGER_FORMAT.format(Math.max(0, value));
    }

    record PanelModel(
            boolean loading,
            boolean error,
            boolean empty,
            String shortRestText,
            String longRestText,
            String budgetText,
            String message
    ) {

        PanelModel {
            shortRestText = safe(shortRestText);
            longRestText = safe(longRestText);
            budgetText = safe(budgetText);
            message = safe(message);
        }

        static PanelModel loadingModel() {
            return new PanelModel(true, false, false, "", "", "", "Lade...");
        }

        static PanelModel empty(String message) {
            return new PanelModel(false, false, true, "", "", "", message);
        }

        static PanelModel error(String message) {
            return new PanelModel(false, true, false, "", "", "", message);
        }
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }
}
