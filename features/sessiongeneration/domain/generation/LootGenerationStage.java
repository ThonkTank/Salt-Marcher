package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Curse;
import features.sessiongeneration.domain.catalog.GenerationCatalog.LootDefinition;
import features.sessiongeneration.domain.catalog.GenerationCatalog.MagicDefinition;
import features.sessiongeneration.domain.catalog.GenerationCatalog.MagicVariant;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Rarity;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Role;
import features.sessiongeneration.domain.generation.GeneratedRun.LootLine;
import features.sessiongeneration.domain.generation.GeneratedRun.LootRole;
import features.sessiongeneration.domain.generation.GeneratedRun.SessionContext;
import features.sessiongeneration.domain.generation.GeneratedRun.TreasurePlan;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class LootGenerationStage {

    List<LootLine> generate(
            SessionContext session,
            List<Rarity> rarities,
            List<TreasurePlan> treasures,
            CatalogSnapshot catalog,
            KeyedEntropy entropy
    ) {
        List<LootLine> result = new ArrayList<>();
        int lineId = 1;
        for (TreasurePlan treasure : treasures) {
            long spent = 0L;
            for (int slot = 1; slot <= treasure.nonMagicSlots(); slot++) {
                long available = Math.max(0L, (treasure.targetCp() - spent)
                        / (treasure.nonMagicSlots() - slot + 1L));
                double roll = entropy.unit("loot-role", lineId, treasure.treasureId());
                LootRole role = roll < 0.60 ? LootRole.CARRIER : roll < 0.90 ? LootRole.USEFUL : LootRole.FLAVOR;
                Selection selected = selectMundane(catalog, role, available, lineId, treasure, entropy);
                result.add(new LootLine(
                        lineId++, treasure.treasureId(), role, selected.itemId(), selected.text(),
                        selected.quantity(), selected.unitCp(), selected.actualCp(), selected.totalCapacity(),
                        selected.allowedContainers(), "", false));
                spent += selected.actualCp();
            }
        }
        int magicIndex = 0;
        for (TreasurePlan treasure : treasures) {
            for (int slot = 0; slot < treasure.magicSlots(); slot++) {
                Rarity rarity = rarities.isEmpty()
                        ? Rarity.COMMON
                        : rarities.get(Math.min(magicIndex, rarities.size() - 1));
                MagicResolution magic = resolveMagic(catalog, rarity, treasure, magicIndex + 1, entropy);
                result.add(new LootLine(
                        lineId++, treasure.treasureId(), LootRole.MAGIC, magic.id(), magic.text(),
                        1L, 0L, 0L, BigDecimal.ZERO, "none", GenerationMath.title(rarity), magic.cursed()));
                magicIndex++;
            }
        }
        return List.copyOf(result);
    }

    private static Selection selectMundane(
            CatalogSnapshot catalog,
            LootRole role,
            long available,
            int lineId,
            TreasurePlan treasure,
            KeyedEntropy entropy
    ) {
        Role catalogRole = switch (role) {
            case CARRIER -> Role.CARRIER;
            case USEFUL -> Role.USEFUL;
            case FLAVOR -> Role.FLAVOR;
            case MAGIC -> throw new IllegalArgumentException("magic has no mundane pool");
        };
        List<LootDefinition> pool = catalog.loot().stream()
                .filter(item -> item.role() == catalogRole && item.baseCp() > 0L).toList();
        if (pool.isEmpty()) throw new IllegalStateException("catalog contains no " + role + " loot");
        if (role == LootRole.CARRIER) {
            double bulkRoll = entropy.unit("carrier-bulk", lineId, treasure.treasureId());
            if (bulkRoll < 0.25) {
                List<LootDefinition> bulk = pool.stream()
                        .filter(item -> item.valueForm().equals("Quantity_Good"))
                        .filter(item -> contextualWeight(item, available).compareTo(new BigDecimal("20")) >= 0)
                        .toList();
                if (!bulk.isEmpty()) pool = bulk;
            } else {
                int form = entropy.index("carrier-form", lineId, treasure.treasureId(), 8);
                if (form == 4) return coins(available, lineId, treasure.treasureId(), entropy);
                if (form == 3) {
                    Selection adorned = adorned(catalog, available, lineId, treasure, entropy);
                    if (adorned != null) return adorned;
                }
                List<LootDefinition> shaped = pool.stream().filter(item -> carrierForm(item, form, available)).toList();
                if (!shaped.isEmpty()) pool = shaped;
            }
        }
        List<SelectionCandidate> candidates = pool.stream()
                .map(item -> candidate(item, role, available))
                .filter(candidate -> candidate != null)
                .toList();
        if (candidates.isEmpty()) {
            candidates = pool.stream().map(item -> fallbackCandidate(item, available)).toList();
        }
        long bestGap = candidates.stream().mapToLong(item -> Math.abs(item.actualCp() - available)).min().orElse(0L);
        long tolerance = Math.round(available * 0.05);
        List<SelectionCandidate> near = candidates.stream()
                .filter(item -> Math.abs(item.actualCp() - available) <= bestGap + tolerance)
                .sorted(Comparator.comparingInt(item -> item.definition().sortOrder())).toList();
        SelectionCandidate selected = near.get(entropy.index(
                "loot-pick-" + treasure.theme(), lineId, treasure.treasureId(), near.size()));
        LootDefinition item = selected.definition();
        Selection selection = new Selection(
                item.id(), selected.quantity() + "x " + item.name(), selected.quantity(), item.baseCp(),
                selected.actualCp(), item.capacity().multiply(BigDecimal.valueOf(selected.quantity())),
                item.allowedContainers());
        return role == LootRole.USEFUL
                ? usefulVariant(catalog, item, selection, available, lineId, treasure, entropy)
                : selection;
    }

    private static Selection adorned(
            CatalogSnapshot catalog,
            long available,
            int lineId,
            TreasurePlan treasure,
            KeyedEntropy entropy
    ) {
        List<LootDefinition> bases = catalog.loot().stream()
                .filter(item -> item.baseCp() > 0L && item.baseCp() <= available)
                .filter(item -> !item.modularProfiles().isEmpty())
                .filter(item -> !item.allowedContainers().isBlank())
                .sorted(Comparator.comparingLong(item -> Math.abs(item.baseCp() - available)))
                .limit(20).toList();
        if (bases.isEmpty()) return null;
        List<AdornedCandidate> candidates = new ArrayList<>();
        for (LootDefinition base : bases) {
            for (var modifier : catalog.lootModifiers()) {
                if (!modifier.kind().equals("modular") || !matchesModifier(catalog, modifier, base)) continue;
                long baseValue = base.baseCp() + modifier.flatValueCp();
                if (modifier.componentType().isBlank() || modifier.componentType().equals("none")) {
                    if (baseValue <= Math.round(available * 1.05)) {
                        candidates.add(new AdornedCandidate(base, modifier, null, 0, baseValue));
                    }
                    continue;
                }
                for (LootDefinition component : catalog.loot()) {
                    if (!component.canAdorn()
                            || !component.adornmentType().equalsIgnoreCase(modifier.componentType())
                            || component.baseCp() <= 0L) continue;
                    for (int quantity = Math.max(1, modifier.minimumQuantity());
                            quantity <= Math.max(modifier.minimumQuantity(), modifier.maximumQuantity()); quantity++) {
                        long value = baseValue + quantity * component.baseCp();
                        if (value <= Math.round(available * 1.05)) {
                            candidates.add(new AdornedCandidate(base, modifier, component, quantity, value));
                        }
                    }
                }
            }
        }
        if (candidates.isEmpty()) return null;
        long bestGap = candidates.stream().mapToLong(candidate -> Math.abs(candidate.actualCp() - available))
                .min().orElseThrow();
        long tolerance = Math.round(available * 0.05);
        List<AdornedCandidate> near = candidates.stream()
                .filter(candidate -> Math.abs(candidate.actualCp() - available) <= bestGap + tolerance)
                .sorted(Comparator.comparingInt(candidate -> candidate.base().sortOrder())).toList();
        AdornedCandidate selected = near.get(entropy.index(
                "adorned-pick", lineId, treasure.treasureId(), near.size()));
        String text = selected.modifier().textTemplate().replace("{item}", selected.base().name())
                .replace("{qty}", Integer.toString(selected.componentQuantity()))
                .replace("{component}", selected.component() == null ? "" : selected.component().name());
        return new Selection(
                "procedural:adorned:" + selected.base().id() + ":" + selected.modifier().id(), text, 1L,
                selected.actualCp(), selected.actualCp(), selected.base().capacity(), selected.base().allowedContainers());
    }

    private static Selection usefulVariant(
            CatalogSnapshot catalog,
            LootDefinition item,
            Selection base,
            long available,
            int lineId,
            TreasurePlan treasure,
            KeyedEntropy entropy
    ) {
        List<features.sessiongeneration.domain.catalog.GenerationCatalog.LootModifier> modifiers =
                catalog.lootModifiers().stream()
                        .filter(modifier -> modifier.kind().equals("variant"))
                        .filter(modifier -> matchesModifier(catalog, modifier, item))
                        .filter(modifier -> base.actualCp() + modifier.flatValueCp() <= Math.round(available * 1.05))
                        .sorted(Comparator.comparingLong(modifier -> Math.abs(
                                base.actualCp() + modifier.flatValueCp() - available)))
                        .toList();
        if (modifiers.isEmpty()) return base;
        long bestGap = Math.abs(base.actualCp() + modifiers.getFirst().flatValueCp() - available);
        List<features.sessiongeneration.domain.catalog.GenerationCatalog.LootModifier> best = modifiers.stream()
                .filter(modifier -> Math.abs(base.actualCp() + modifier.flatValueCp() - available) == bestGap).toList();
        var modifier = best.get(entropy.index("useful-variant", lineId, treasure.treasureId(), best.size()));
        String detail = modifier.details().isEmpty()
                ? ""
                : modifier.details().get(entropy.index("variant-detail", lineId, treasure.treasureId(),
                        modifier.details().size()));
        String text = modifier.textTemplate().replace("{item}", item.name()).replace("{detail}", detail);
        long actual = base.actualCp() + modifier.flatValueCp();
        return new Selection(
                base.itemId() + ":" + modifier.id(), text, base.quantity(), actual, actual,
                base.totalCapacity(), base.allowedContainers());
    }

    private static boolean matchesModifier(
            CatalogSnapshot catalog,
            features.sessiongeneration.domain.catalog.GenerationCatalog.LootModifier modifier,
            LootDefinition item
    ) {
        if (!modifier.lootType().equals("all") && !modifier.lootType().equals(item.type())) return false;
        List<String> profiles = new ArrayList<>(modifier.allowedProfiles());
        catalog.lootRelations().stream()
                .filter(relation -> relation.type().equals("MODIFIER_PROFILE"))
                .filter(relation -> relation.sourceId().equals(modifier.id()))
                .map(relation -> normalizeRelationTarget(relation.targetId())).forEach(profiles::add);
        boolean profileMatches = profiles.contains("all")
                || item.modularProfiles().stream().map(LootGenerationStage::normalize)
                        .anyMatch(profile -> profiles.stream().map(LootGenerationStage::normalize)
                                .anyMatch(profile::equals));
        if (!profileMatches) return false;
        List<String> categories = new ArrayList<>(modifier.allowedCategories());
        catalog.lootRelations().stream()
                .filter(relation -> relation.type().equals("MODIFIER_CATEGORY"))
                .filter(relation -> relation.sourceId().equals(modifier.id()))
                .map(relation -> normalizeRelationTarget(relation.targetId())).forEach(categories::add);
        return categories.isEmpty() || categories.contains("all")
                || categories.stream().map(LootGenerationStage::normalize)
                        .anyMatch(normalize(item.category())::equals);
    }

    private static String normalizeRelationTarget(String value) {
        int separator = value.indexOf(':');
        return normalize(separator >= 0 ? value.substring(separator + 1) : value);
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(java.util.Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private static SelectionCandidate candidate(LootDefinition item, LootRole role, long available) {
        long cap = quantityCap(item, role);
        BigDecimal ratio = BigDecimal.valueOf(available)
                .divide(BigDecimal.valueOf(item.baseCp()), 12, java.math.RoundingMode.HALF_UP);
        long floor = Math.max(1L, Math.min(cap, ratio.setScale(0, java.math.RoundingMode.FLOOR).longValue()));
        long ceil = Math.max(1L, Math.min(cap, ratio.setScale(0, java.math.RoundingMode.CEILING).longValue()));
        long quantity = chooseQuantity(item.baseCp(), available, floor, ceil);
        long actual = quantity * item.baseCp();
        boolean overfit = actual > Math.round(available * 1.05);
        boolean underfit = role != LootRole.CARRIER && actual < Math.round(available * 0.50);
        return overfit || underfit ? null : new SelectionCandidate(item, quantity, actual);
    }

    private static SelectionCandidate fallbackCandidate(LootDefinition item, long available) {
        long quantity = Math.max(1L, available / Math.max(1L, item.baseCp()));
        return new SelectionCandidate(item, quantity, quantity * item.baseCp());
    }

    private static long chooseQuantity(long unitCp, long available, long floor, long ceil) {
        if (ceil * unitCp > Math.round(available * 1.05)) return floor;
        return Math.abs(floor * unitCp - available) <= Math.abs(ceil * unitCp - available) ? floor : ceil;
    }

    private static BigDecimal contextualWeight(LootDefinition item, long available) {
        long quantity = Math.max(1L, available / Math.max(1L, item.baseCp()));
        return item.baseWeight().multiply(BigDecimal.valueOf(quantity));
    }

    private static boolean carrierForm(LootDefinition item, int form, long available) {
        return switch (form) {
            case 0 -> item.category().toLowerCase().contains("ingot");
            case 1 -> item.category().toLowerCase().contains("art");
            case 2 -> item.category().toLowerCase().contains("gem");
            case 3 -> item.category().toLowerCase().contains("art") || item.category().toLowerCase().contains("jewel");
            case 5 -> item.valueForm().equals("Quantity_Good")
                    && contextualWeight(item, available).compareTo(new BigDecimal("20")) < 0;
            case 6 -> item.type().equals("livestock");
            case 7 -> item.category().toLowerCase().contains("clothing");
            default -> false;
        };
    }

    private static Selection coins(long available, int lineId, int treasureId, KeyedEntropy entropy) {
        String[] profiles = {"pp_gp", "gp_ep", "gp_sp", "ep_sp", "sp_cp", "pp_gp_ep", "pp_gp_sp", "gp_ep_sp", "ep_sp_cp"};
        String profile = profiles[entropy.index("coin-profile", lineId, treasureId, profiles.length)];
        int[] values = java.util.Arrays.stream(profile.split("_"))
                .mapToInt(LootGenerationStage::coinValue).toArray();
        long[] counts = new long[values.length];
        int low = values.length - 1;
        counts[low] = 5L;
        if (values.length == 3) {
            counts[1] = 1L;
        }
        long reserved = counts[low] * values[low] + (values.length == 3 ? values[1] : 0L);
        long remaining = Math.max(0L, available - reserved);
        counts[0] = Math.max(1L, remaining / Math.max(values[0], 1));
        remaining = Math.max(0L, remaining - counts[0] * values[0]);
        if (values.length == 3) {
            long extraMiddle = Math.min(299L, remaining / Math.max(values[1], 1));
            counts[1] += extraMiddle;
            remaining -= extraMiddle * values[1];
        }
        long extraLow = Math.min(25L, remaining / Math.max(values[low], 1));
        counts[low] += extraLow;
        long actual = 0L;
        for (int index = 0; index < values.length; index++) actual += counts[index] * values[index];
        if (actual == available) {
            long delta = entropy.unit("coin-rounding", lineId, treasureId) < 0.5 && counts[low] > 5L ? -1L : 1L;
            if (counts[low] >= 30L) delta = -1L;
            counts[low] += delta;
            actual += delta * values[low];
        }
        StringBuilder text = new StringBuilder();
        String[] names = profile.split("_");
        for (int index = 0; index < names.length; index++) {
            if (index > 0) text.append(", ");
            text.append(counts[index]).append(' ').append(names[index]);
        }
        BigDecimal capacity = BigDecimal.valueOf(Math.max(1L, actual))
                .divide(BigDecimal.valueOf(10_000L), 2, java.math.RoundingMode.CEILING)
                .divide(BigDecimal.valueOf(50L), 8, java.math.RoundingMode.HALF_UP)
                .max(new BigDecimal("0.01"));
        return new Selection("synthetic:coins:" + profile, text.toString(), 1L, actual, actual, capacity, "Pouch,Chest");
    }

    private static int coinValue(String denomination) {
        return switch (denomination) {
            case "pp" -> 1000;
            case "gp" -> 100;
            case "ep" -> 50;
            case "sp" -> 10;
            case "cp" -> 1;
            default -> throw new IllegalArgumentException("unknown denomination");
        };
    }

    private static long quantityCap(LootDefinition item, LootRole role) {
        if (item.name().contains("(lb)") || item.name().contains("(pint)") || item.name().contains("(fl oz)")) {
            return 10_000L;
        }
        if (role == LootRole.FLAVOR) return 50L;
        if (item.category().contains("Ammunition")) return 20L;
        if (item.category().contains("Potion") || item.category().contains("Poison")) return 3L;
        return role == LootRole.CARRIER ? 250L : 1L;
    }

    private static MagicResolution resolveMagic(
            CatalogSnapshot catalog,
            Rarity rarity,
            TreasurePlan treasure,
            int magicIndex,
            KeyedEntropy entropy
    ) {
        List<MagicDefinition> typed = catalog.magic().stream()
                .filter(item -> item.rarity() == rarity && item.type().equals(treasure.magicType()))
                .sorted(Comparator.comparingInt(MagicDefinition::sortOrder)).toList();
        List<MagicDefinition> pool = typed.isEmpty()
                ? catalog.magic().stream().filter(item -> item.rarity() == rarity)
                        .sorted(Comparator.comparingInt(MagicDefinition::sortOrder)).toList()
                : typed;
        if (pool.isEmpty()) throw new IllegalStateException("catalog contains no magic item for " + rarity);
        MagicDefinition selected = pool.get(entropy.index(
                "magic-item", magicIndex, treasure.treasureId(), pool.size()));
        String text = switch (selected.decisionType()) {
            case "fixed_variant" -> selected.item() + " — " + selected.infoOne();
            case "variant_group" -> resolveVariant(catalog, selected, treasure, magicIndex, entropy);
            case "spell_level" -> resolveSpell(catalog, selected, treasure, magicIndex, entropy);
            case "enspelled_item" -> resolveEnspelled(catalog, selected, treasure, magicIndex, entropy);
            default -> selected.item();
        };
        boolean cursed = !catalog.curses().isEmpty()
                && entropy.unit("magic-curse", magicIndex, treasure.treasureId()) < 0.20;
        if (cursed) {
            Curse curse = weightedCurse(catalog.curses(), entropy, magicIndex, treasure.treasureId());
            text += " [CURSED — " + curse.name() + ": " + curse.effect() + "]";
        }
        return new MagicResolution(selected.id(), text, cursed);
    }

    private static String resolveVariant(
            CatalogSnapshot catalog,
            MagicDefinition selected,
            TreasurePlan treasure,
            int magicIndex,
            KeyedEntropy entropy
    ) {
        List<MagicVariant> variants = catalog.variants().stream()
                .filter(variant -> variant.group().equals(selected.infoOne()))
                .sorted(Comparator.comparingInt(MagicVariant::sortOrder)).toList();
        if (variants.isEmpty()) return selected.item();
        MagicVariant variant = variants.get(entropy.index(
                "magic-variant", magicIndex, treasure.treasureId(), variants.size()));
        return selected.item() + " — " + variant.option();
    }

    private static String resolveSpell(
            CatalogSnapshot catalog,
            MagicDefinition selected,
            TreasurePlan treasure,
            int magicIndex,
            KeyedEntropy entropy
    ) {
        int minimum = 0;
        int maximum = 9;
        try {
            String[] values = selected.infoOne().split("-");
            minimum = Integer.parseInt(values[0].replaceAll("[^0-9]", ""));
            maximum = values.length > 1
                    ? Integer.parseInt(values[1].replaceAll("[^0-9]", ""))
                    : minimum;
        } catch (RuntimeException ignored) {
            // Preserve catalog fallback behavior below.
        }
        final int low = minimum;
        final int high = maximum;
        var spells = themedSpells(catalog, treasure, low, high);
        if (spells.isEmpty()) return selected.item() + " [unresolved]";
        var spell = spells.get(entropy.index(
                "magic-spell-" + treasure.theme(), magicIndex, treasure.treasureId(), spells.size()));
        return selected.item() + " — " + spell.name();
    }

    private static String resolveEnspelled(
            CatalogSnapshot catalog,
            MagicDefinition selected,
            TreasurePlan treasure,
            int magicIndex,
            KeyedEntropy entropy
    ) {
        var rules = catalog.enspelledRules().stream()
                .filter(rule -> rule.chassis().equalsIgnoreCase(selected.infoOne()))
                .filter(rule -> rule.rarity() == selected.rarity())
                .toList();
        if (rules.isEmpty()) return selected.item() + " [unresolved]";
        var rule = rules.get(entropy.index("enspelled-rule", magicIndex, treasure.treasureId(), rules.size()));
        var spells = themedSpells(catalog, treasure, rule.spellLevel(), rule.spellLevel());
        if (spells.isEmpty()) return selected.item() + " [unresolved]";
        var spell = spells.get(entropy.index("enspelled-spell", magicIndex, treasure.treasureId(), spells.size()));
        java.util.regex.Pattern pattern;
        try {
            pattern = java.util.regex.Pattern.compile(rule.baseItemRegex(), java.util.regex.Pattern.CASE_INSENSITIVE);
        } catch (RuntimeException exception) {
            return selected.item() + " [unresolved]";
        }
        var bases = catalog.loot().stream()
                .filter(item -> item.type().equals("object"))
                .filter(item -> pattern.matcher(item.name() + " " + item.category()).find())
                .filter(item -> rule.maxBaseCapacity().signum() <= 0
                        || item.capacity().compareTo(rule.maxBaseCapacity()) <= 0)
                .toList();
        if (bases.isEmpty()) return selected.item() + " [unresolved]";
        var base = bases.get(entropy.index("enspelled-base", magicIndex, treasure.treasureId(), bases.size()));
        return "Enspelled " + base.name() + " — " + spell.name() + " (" + rule.maxCharges()
                + " charges; regains " + rule.recharge() + " at dawn; DC " + rule.saveDc()
                + "/+" + rule.attackBonus() + ")";
    }

    private static List<features.sessiongeneration.domain.catalog.GenerationCatalog.Spell> themedSpells(
            CatalogSnapshot catalog,
            TreasurePlan treasure,
            int minimum,
            int maximum
    ) {
        var all = catalog.spells().stream()
                .filter(spell -> spell.level() >= minimum && spell.level() <= maximum).toList();
        var theme = catalog.themes().stream().filter(value -> value.name().equals(treasure.theme())).findFirst();
        if (theme.isEmpty() || theme.get().spellColors().isEmpty()) return all;
        var themed = all.stream().filter(spell -> spell.elements().stream()
                .anyMatch(theme.get().spellColors()::contains)).toList();
        return themed.isEmpty() ? all : themed;
    }

    private static Curse weightedCurse(List<Curse> curses, KeyedEntropy entropy, int magicIndex, int treasureId) {
        int total = curses.stream().mapToInt(Curse::weight).sum();
        int ticket = entropy.index("curse-ticket", magicIndex, treasureId, Math.max(1, total)) + 1;
        int cursor = 0;
        for (Curse curse : curses) {
            cursor += curse.weight();
            if (cursor >= ticket) return curse;
        }
        return curses.getLast();
    }

    private record MagicResolution(String id, String text, boolean cursed) {
    }

    private record SelectionCandidate(LootDefinition definition, long quantity, long actualCp) {
    }

    private record AdornedCandidate(
            LootDefinition base,
            features.sessiongeneration.domain.catalog.GenerationCatalog.LootModifier modifier,
            LootDefinition component,
            int componentQuantity,
            long actualCp
    ) {
    }

    private record Selection(
            String itemId,
            String text,
            long quantity,
            long unitCp,
            long actualCp,
            BigDecimal totalCapacity,
            String allowedContainers
    ) {
    }
}
