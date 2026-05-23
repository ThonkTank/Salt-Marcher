package src.view.statetabs.encounter;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.encounter.published.EncounterStateSnapshot;

final class EncounterCombatStateContentModel {

    private static final double HEALTHY_THRESHOLD = 0.5;
    private static final double WOUNDED_THRESHOLD = 0.25;

    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.empty());

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    void showCombat(EncounterStateSnapshot.CombatPane source) {
        EncounterStateSnapshot.CombatPane safeSource = source == null
                ? EncounterStateSnapshot.CombatPane.empty()
                : source;
        panel.set(new PanelModel(
                safeSource.roundIndex(),
                safeSource.combatStatus(),
                safeSource.combatCards().stream()
                        .map(card -> new CardView(
                                card.combatantId(),
                                card.displayName(),
                                card.playerCharacter(),
                                card.activeTurn(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiativeValue(),
                                card.count(),
                                card.detailText()))
                        .toList(),
                safeSource.allEnemiesDefeated(),
                safeSource.addablePartyMembers().stream()
                        .map(member -> new PartyMemberCandidate(
                                member.partyMemberId(),
                                member.displayName(),
                                member.level()))
                        .toList()));
    }

    PanelModel safePanel(PanelModel state) {
        return state == null ? PanelModel.empty() : state;
    }

    HpMeterDisplay hpMeterDisplay(CardView card) {
        CardView safeCard = card == null
                ? new CardView("", "", false, false, false, 0, 0, 0, 0, 1, "")
                : card;
        double fraction = safeCard.maxHp() > 0
                ? Math.max(0.0, Math.min(1.0, (double) safeCard.currentHp() / safeCard.maxHp()))
                : 0.0;
        String hpText = safeCard.currentHp() + " / " + safeCard.maxHp();
        return new HpMeterDisplay(
                fraction,
                (fraction <= WOUNDED_THRESHOLD ? "! " : "") + hpText,
                safeCard.name() + " HP " + hpText,
                hpFillStyle(fraction));
    }

    private static String hpFillStyle(double fraction) {
        if (fraction > HEALTHY_THRESHOLD) {
            return "hp-fill-healthy";
        }
        if (fraction > WOUNDED_THRESHOLD) {
            return "hp-fill-wounded";
        }
        return "hp-fill-critical";
    }

    record HpMeterDisplay(
            double fraction,
            String text,
            String accessibleText,
            String fillStyleClass
    ) {
        HpMeterDisplay {
            fraction = Math.max(0.0, Math.min(1.0, fraction));
            text = text == null ? "" : text;
            accessibleText = accessibleText == null || accessibleText.isBlank() ? text : accessibleText;
            fillStyleClass = fillStyleClass == null ? "" : fillStyleClass;
        }
    }

    record CardView(
            String id,
            String name,
            boolean playerCharacter,
            boolean active,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiative,
            int count,
            String detail
    ) {
        CardView {
            id = id == null ? "" : id;
            name = name == null ? "" : name;
            detail = detail == null ? "" : detail;
            count = Math.max(1, count);
        }
    }

    record PartyMemberCandidate(long memberId, String name, int level) {
        PartyMemberCandidate {
            memberId = Math.max(0L, memberId);
            name = name == null ? "" : name;
        }
    }

    record PanelModel(
            int round,
            String status,
            List<CardView> cards,
            boolean allEnemiesDefeated,
            List<PartyMemberCandidate> missingPartyMembers
    ) {
        PanelModel {
            status = status == null ? "" : status;
            cards = cards == null ? List.of() : List.copyOf(cards);
            missingPartyMembers = missingPartyMembers == null ? List.of() : List.copyOf(missingPartyMembers);
        }

        static PanelModel empty() {
            return new PanelModel(0, "", List.of(), false, List.of());
        }
    }
}
