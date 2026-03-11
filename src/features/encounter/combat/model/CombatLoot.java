package features.encounter.combat.model;

import shared.rules.model.LootCoins;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record CombatLoot(
        LootCoins coins,
        List<ItemLoot> items
) {
    public CombatLoot {
        coins = coins == null ? LootCoins.zero() : coins;
        List<ItemLoot> copy = new ArrayList<>();
        if (items != null) {
            for (ItemLoot item : items) {
                if (item != null) copy.add(item);
            }
        }
        items = List.copyOf(copy);
    }

    public static CombatLoot empty() {
        return new CombatLoot(LootCoins.zero(), List.of());
    }

    public CombatLoot plus(CombatLoot other) {
        if (other == null) return this;
        List<ItemLoot> combined = new ArrayList<>(items.size() + other.items.size());
        combined.addAll(items);
        combined.addAll(other.items);
        return new CombatLoot(coins.plus(other.coins), combined);
    }

    public boolean hasAnyLoot() {
        return coins.totalCpValue() > 0 || !items.isEmpty();
    }

    public int totalItemCpValue() {
        int total = 0;
        for (ItemLoot item : items) {
            total += Math.max(0, item.costCp());
        }
        return total;
    }

    public String formatCompact() {
        if (items.isEmpty()) {
            return coins.formatCompact();
        }
        if (coins.totalCpValue() <= 0) {
            return items.size() + " Item" + (items.size() == 1 ? "" : "s");
        }
        return coins.formatCompact() + " + " + items.size() + " Item" + (items.size() == 1 ? "" : "s");
    }

    public String formatDetailed() {
        if (!hasAnyLoot()) return "Kein Loot";
        List<String> parts = new ArrayList<>();
        if (coins.totalCpValue() > 0) parts.add(coins.formatCompact());
        if (!items.isEmpty()) {
            parts.add(items.stream().map(ItemLoot::summary).filter(Objects::nonNull).toList().toString());
        }
        return String.join(" · ", parts);
    }
}
