package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Theme;
import features.sessiongeneration.domain.generation.GeneratedRun.EncounterPlan;
import features.sessiongeneration.domain.generation.GeneratedRun.RewardChannel;
import features.sessiongeneration.domain.generation.GeneratedRun.SessionContext;
import features.sessiongeneration.domain.generation.GeneratedRun.StockClass;
import features.sessiongeneration.domain.generation.GeneratedRun.TreasurePlan;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

final class TreasurePlanningStage {

    List<TreasurePlan> plan(
            SessionContext session,
            List<EncounterPlan> encounters,
            CatalogSnapshot catalog,
            long seed
    ) {
        int count = session.treasureCount();
        int normalCount = count - 1;
        int[] slots = allocateSlots(session.nonMagicSlots(), count);
        List<Integer> bossOrder = encounters.stream()
                .sorted(Comparator.comparing(EncounterPlan::bossScore).reversed()
                        .thenComparingInt(EncounterPlan::encounterNumber))
                .map(EncounterPlan::encounterNumber).toList();
        List<Theme> themes = catalog.themes().stream().sorted(Comparator.comparingInt(Theme::sortOrder)).toList();
        List<TreasurePlan> plans = new ArrayList<>();
        boolean questUsed = false;
        int encounterAnchor = 0;
        long normalAllocated = 0L;
        for (int index = 0; index < count; index++) {
            int id = index + 1;
            StockClass stock = id <= normalCount ? StockClass.NORMAL : StockClass.OVERSTOCK;
            long targetCp;
            if (stock == StockClass.OVERSTOCK) {
                targetCp = session.overstockBudgetCp();
            } else if (id == normalCount) {
                targetCp = session.normalBudgetCp() - normalAllocated;
            } else {
                double weight = normalCount == 1 ? 1.0 : 1.2 - 0.4 * index / (normalCount - 1.0);
                targetCp = Math.round(session.normalBudgetCp() * weight / normalCount);
                normalAllocated += targetCp;
            }
            double channelRoll = Math.floorMod(seed + id * 719L, 10_000L) / 10_000.0;
            double questWeight = questUsed ? 0.0 : 0.4;
            double encounterWeight = encounterAnchor < bossOrder.size() ? 0.4 : 0.0;
            double environmentWeight = 0.2;
            double totalWeight = questWeight + encounterWeight + environmentWeight;
            double questEnd = questWeight / totalWeight;
            double encounterEnd = questEnd + encounterWeight / totalWeight;
            RewardChannel channel;
            if (channelRoll < questEnd) {
                channel = RewardChannel.QUEST;
                questUsed = true;
            } else if (channelRoll < encounterEnd) {
                channel = RewardChannel.ENCOUNTER;
            } else {
                channel = RewardChannel.ENVIRONMENT;
            }
            int anchor = channel == RewardChannel.ENCOUNTER ? bossOrder.get(encounterAnchor++) : 0;
            Theme theme = themes.get((int) Math.floorMod(seed + id * 997L, themes.size()));
            int magicSlots = stock == StockClass.NORMAL && id <= session.normalMagic()
                    ? 1
                    : stock == StockClass.OVERSTOCK && id - normalCount <= session.overstockMagic() ? 1 : 0;
            plans.add(new TreasurePlan(
                    id, stock, channel, anchor, theme.name(), theme.magicType(), targetCp, slots[index], magicSlots));
        }
        return List.copyOf(plans);
    }

    private static int[] allocateSlots(int totalSlots, int treasures) {
        int[] result = new int[treasures];
        Arrays.fill(result, 1);
        int remaining = totalSlots - treasures;
        int weightTotal = treasures * (treasures + 1) / 2;
        int assigned = 0;
        for (int index = 0; index < treasures; index++) {
            int extra = remaining * (treasures - index) / weightTotal;
            result[index] += extra;
            assigned += extra;
        }
        for (int index = 0; assigned < remaining; index = (index + 1) % treasures) {
            result[index]++;
            assigned++;
        }
        return result;
    }
}
