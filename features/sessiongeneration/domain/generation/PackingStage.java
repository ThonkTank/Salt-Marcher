package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.catalog.GenerationCatalog.Container;
import features.sessiongeneration.domain.generation.GeneratedRun.LootLine;
import features.sessiongeneration.domain.generation.GeneratedRun.PackingRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class PackingStage {

    List<PackingRow> pack(List<LootLine> loot, List<Container> containers, KeyedEntropy entropy) {
        Map<String, Container> byName = new HashMap<>();
        containers.forEach(container -> byName.put(container.name(), container));
        Map<String, BigDecimal> cumulativeCapacity = new HashMap<>();
        List<PackingRow> result = new ArrayList<>();
        for (LootLine line : loot) {
            if (loose(line)) {
                result.add(new PackingRow(line.lineId(), line.treasureId(), "none", 0, "none", true));
                continue;
            }
            List<Choice> choices = choices(line, byName);
            if (choices.isEmpty()) {
                result.add(new PackingRow(line.lineId(), line.treasureId(), "none", 0, "none", true));
                continue;
            }
            int minimum = choices.stream().mapToInt(Choice::count).min().orElse(1);
            List<Choice> eligible = choices.stream()
                    .filter(choice -> choice.count() <= minimum * 4
                            && choice.fill().compareTo(new BigDecimal("0.25")) >= 0)
                    .toList();
            if (eligible.isEmpty()) {
                BigDecimal best = choices.stream().map(Choice::fill).max(Comparator.naturalOrder()).orElseThrow();
                eligible = choices.stream().filter(choice -> choice.fill().compareTo(best) == 0).toList();
            }
            Choice choice = eligible.get(entropy.index("packing", line.lineId(), line.treasureId(), eligible.size()));
            if (choice.container().hidden()) {
                result.add(new PackingRow(line.lineId(), line.treasureId(), "none", 0, "none", true));
            } else {
                String group = line.treasureId() + "|" + choice.container().name();
                BigDecimal used = cumulativeCapacity.getOrDefault(group, BigDecimal.ZERO)
                        .add(line.totalCapacity());
                cumulativeCapacity.put(group, used);
                int groupEnd = used.divide(choice.container().capacity(), 0, RoundingMode.CEILING).intValue();
                String id = groupEnd == 1
                        ? choice.container().name() + " 1"
                        : choice.container().name() + " 1-" + groupEnd;
                result.add(new PackingRow(
                        line.lineId(), line.treasureId(), choice.container().name(), choice.count(), id, true));
            }
        }
        return List.copyOf(result);
    }

    private static boolean loose(LootLine line) {
        return line.totalCapacity().compareTo(BigDecimal.ZERO) <= 0
                || line.allowedContainers().isBlank()
                || line.allowedContainers().equalsIgnoreCase("none")
                || line.quantity() <= 1L
                        && line.totalCapacity().compareTo(BigDecimal.valueOf(2L)) >= 0
                        && !line.text().contains("(lb)")
                        && !line.text().contains("pint")
                        && !line.text().contains("fl oz");
    }

    private static List<Choice> choices(LootLine line, Map<String, Container> containers) {
        List<Choice> result = new ArrayList<>();
        for (String name : line.allowedContainers().split(",")) {
            addChoice(result, line, containers.get(name.trim()));
        }
        if (line.quantity() >= 5L && !line.text().contains("pint") && !line.text().contains("fl oz")) {
            addChoice(result, line, containers.get("Pile"));
        }
        return result;
    }

    private static void addChoice(List<Choice> choices, LootLine line, Container container) {
        if (container == null || container.capacity().compareTo(BigDecimal.ZERO) <= 0) return;
        int count = line.totalCapacity().divide(container.capacity(), 0, RoundingMode.CEILING).intValue();
        int safeCount = Math.max(1, count);
        BigDecimal fill = line.totalCapacity().divide(
                container.capacity().multiply(BigDecimal.valueOf(safeCount)), 8, RoundingMode.HALF_UP);
        choices.add(new Choice(container, safeCount, fill));
    }

    private record Choice(Container container, int count, BigDecimal fill) {
    }
}
