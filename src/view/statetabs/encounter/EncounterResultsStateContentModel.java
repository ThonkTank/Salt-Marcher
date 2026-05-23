package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.encounter.published.EncounterStateSnapshot;

final class EncounterResultsStateContentModel {

    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.empty());

    private List<EnemyView> enemies = List.of();
    private int partySize = 1;
    private String goldSummary = "Kein Loot";
    private String lootDetail = "";
    private String awardStatus = "";
    private boolean xpAwarded;
    private boolean canAwardXp;
    private double thresholdFraction = 1.0;
    private double xpFraction = 1.0;

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    void showResults(EncounterStateSnapshot.ResolutionPane source) {
        EncounterStateSnapshot.ResolutionPane safeSource = source == null
                ? EncounterStateSnapshot.ResolutionPane.empty()
                : source;
        enemies = safeSource.enemyResults().stream()
                .map(EnemyView::from)
                .toList();
        partySize = Math.max(1, safeSource.partySize());
        goldSummary = safe(safeSource.goldSummary());
        lootDetail = safe(safeSource.lootDetail());
        awardStatus = safe(safeSource.awardStatus());
        xpAwarded = safeSource.xpAwarded();
        canAwardXp = safeSource.canAwardXp();
        rebuildPanel(defaultSelections(enemies));
    }

    void showSelection(
            List<Boolean> selectedEnemies,
            double nextThresholdFraction,
            double nextXpFraction
    ) {
        thresholdFraction = clamp(nextThresholdFraction);
        xpFraction = clamp(nextXpFraction);
        rebuildPanel(selectedEnemies);
    }

    private void rebuildPanel(List<Boolean> selectedEnemies) {
        List<Boolean> selected = normalizeSelections(selectedEnemies, enemies);
        int selectedXp = 0;
        long selectedCount = 0L;
        List<EnemyView> nextEnemies = new ArrayList<>(enemies.size());
        for (int index = 0; index < enemies.size(); index++) {
            EnemyView enemy = enemies.get(index);
            boolean enemySelected = selected.get(index);
            if (enemySelected) {
                selectedXp += enemy.xp();
                selectedCount++;
            }
            nextEnemies.add(enemy.withSelected(enemySelected));
        }
        int thresholdPercent = (int) Math.round(thresholdFraction * 100);
        int xpPercent = (int) Math.round(xpFraction * 100);
        int awardedXp = (int) Math.round(selectedXp * xpFraction);
        int perPlayer = awardedXp / partySize;
        panel.set(new PanelModel(
                nextEnemies,
                selectedCount + " Gegner besiegt | " + selectedXp + " XP",
                perPlayer + " XP",
                "pro Spieler  (" + partySize + " Spieler | " + awardedXp + " XP gesamt)",
                goldSummary,
                lootDetail,
                awardStatus,
                !canAwardXp || xpAwarded,
                thresholdFraction,
                xpFraction,
                thresholdPercent + "%",
                xpPercent + "%"));
    }

    private static List<Boolean> defaultSelections(List<EnemyView> enemies) {
        return enemies.stream()
                .map(EnemyView::defeatedByDefault)
                .toList();
    }

    private static List<Boolean> normalizeSelections(
            List<Boolean> selectedEnemies,
            List<EnemyView> enemies
    ) {
        List<Boolean> selected = new ArrayList<>(enemies.size());
        for (int index = 0; index < enemies.size(); index++) {
            boolean fallback = enemies.get(index).defeatedByDefault();
            if (selectedEnemies == null || index >= selectedEnemies.size()) {
                selected.add(fallback);
            } else {
                selected.add(Boolean.TRUE.equals(selectedEnemies.get(index)));
            }
        }
        return selected;
    }

    private static double clamp(double value) {
        if (Double.isNaN(value)) {
            return 1.0;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    record PanelModel(
            List<EnemyView> enemies,
            String subtitle,
            String xp,
            String party,
            String gold,
            String loot,
            String awardStatus,
            boolean awardButtonDisabled,
            double thresholdFraction,
            double xpFraction,
            String thresholdValue,
            String fractionValue
    ) {
        PanelModel {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            subtitle = safe(subtitle);
            xp = safe(xp);
            party = safe(party);
            gold = safe(gold);
            loot = safe(loot);
            awardStatus = safe(awardStatus);
            thresholdFraction = clamp(thresholdFraction);
            xpFraction = clamp(xpFraction);
            thresholdValue = safe(thresholdValue);
            fractionValue = safe(fractionValue);
        }

        static PanelModel empty() {
            return new PanelModel(
                    List.of(),
                    "0 Gegner besiegt | 0 XP",
                    "0 XP",
                    "",
                    "Kein Loot",
                    "",
                    "",
                    true,
                    1.0,
                    1.0,
                    "100%",
                    "100%");
        }
    }

    record EnemyView(
            String name,
            String status,
            int xp,
            boolean defeatedByDefault,
            String loot,
            boolean selected
    ) {
        EnemyView {
            name = safe(name);
            status = safe(status);
            loot = safe(loot);
        }

        static EnemyView from(EncounterStateSnapshot.ResultEnemy enemy) {
            return new EnemyView(
                    enemy.displayName(),
                    enemy.statusLabel(),
                    enemy.xp(),
                    enemy.defeatedByDefault(),
                    enemy.loot(),
                    enemy.defeatedByDefault());
        }

        EnemyView withSelected(boolean nextSelected) {
            return new EnemyView(name, status, xp, defeatedByDefault, loot, nextSelected);
        }
    }
}
