package src.domain.sessiongeneration;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import src.domain.sessiongeneration.GenerationResult.EncounterPlan;
import src.domain.sessiongeneration.GenerationResult.LootLine;
import src.domain.sessiongeneration.GenerationResult.RarityTarget;
import src.domain.sessiongeneration.GenerationResult.RewardSummary;
import src.domain.sessiongeneration.GenerationResult.SessionContext;
import src.domain.sessiongeneration.GenerationResult.TreasureResult;

final class SheetV1LootGenerator {

    private static final List<String> FORMS = List.of(
            "Ingot", "Art_Object", "Gemstone", "Adorned", "Coinage", "Compact_Good", "Livestock", "Clothing");
    private static final List<String> RARITY_PRIORITY =
            List.of("Legendary", "Very Rare", "Rare", "Uncommon", "Common");
    private static final Pattern MEASURED = Pattern.compile(".*(\\(lb\\)|\\(lb/sq yd\\)|\\(pint\\)|\\(fl oz\\)).*", Pattern.CASE_INSENSITIVE);

    private final SessionGenerationCatalog catalog;
    private final List<Item> items;
    private final List<Theme> themes;
    private final List<MagicItem> magicItems;
    private final List<Map<String, String>> lootModifiers;
    private final List<Map<String, String>> variants;
    private final List<Map<String, String>> spells;
    private final List<Curse> curses;
    private final Map<String, Container> containers;

    SheetV1LootGenerator(SessionGenerationCatalog catalog) {
        this.catalog = catalog;
        items = loadItems();
        themes = loadThemes();
        magicItems = loadMagicItems();
        lootModifiers = catalog.table("DB_LootModifiers");
        variants = catalog.table("DB_MagicVariants");
        spells = catalog.table("DB_Spells");
        curses = loadCurses();
        containers = loadContainers();
    }

    LootOutput generate(GenerationRequest request, SessionContext context, List<EncounterPlan> encounters) {
        List<TreasureDraft> drafts = treasureDrafts(request, context, encounters);
        Map<Integer, List<LootLine>> linesByTreasure = new LinkedHashMap<>();
        int lineId = 1;
        for (TreasureDraft draft : drafts) {
            List<LootLine> lines = new ArrayList<>();
            long spent = 0L;
            for (int slot = 1; slot <= draft.nonMagicSlots(); slot++) {
                double available = Math.max(0d, (draft.targetCp() - spent) / (draft.nonMagicSlots() - slot + 1d));
                LootLine line = nonMagicLine(request, draft, lineId++, slot, available);
                lines.add(line);
                spent += line.actualCp();
            }
            linesByTreasure.put(draft.treasureId(), lines);
        }

        List<String> normalRarities = rarityList(context.rarityTargets(), false);
        List<String> overstockRarities = rarityList(context.rarityTargets(), true);
        int normalMagicIndex = 0;
        int overstockMagicIndex = 0;
        int globalMagicIndex = 0;
        for (TreasureDraft draft : drafts) {
            String rarity = null;
            if ("normal".equals(draft.stockClass()) && normalMagicIndex < normalRarities.size()) {
                rarity = normalRarities.get(normalMagicIndex++);
            } else if ("overstock".equals(draft.stockClass()) && overstockMagicIndex < overstockRarities.size()) {
                rarity = overstockRarities.get(overstockMagicIndex++);
            }
            if (rarity != null) {
                linesByTreasure.get(draft.treasureId())
                        .add(magicLine(request, draft, lineId++, ++globalMagicIndex, rarity));
            }
        }

        List<TreasureResult> results = new ArrayList<>();
        for (TreasureDraft draft : drafts) {
            List<LootLine> lines = linesByTreasure.get(draft.treasureId());
            long actual = lines.stream().mapToLong(LootLine::actualCp).sum();
            results.add(new TreasureResult(
                    draft.treasureId(), draft.stockClass(), draft.rewardChannel(), draft.anchorEncounterNumber(),
                    draft.theme().name(), Math.round(draft.targetCp()), actual, lines));
        }
        long normalActual = results.stream().filter(treasure -> "normal".equals(treasure.stockClass()))
                .mapToLong(TreasureResult::actualCp).sum();
        long overstockActual = results.stream().filter(treasure -> "overstock".equals(treasure.stockClass()))
                .mapToLong(TreasureResult::actualCp).sum();
        List<String> rarities = results.stream().flatMap(treasure -> treasure.loot().stream())
                .map(LootLine::rarity).filter(value -> value != null && !value.isBlank()).toList();
        RewardSummary summary = new RewardSummary(normalActual, overstockActual, rarities.size(), rarities);
        return new LootOutput(List.copyOf(results), summary, format(encounters, results, summary));
    }

    private List<TreasureDraft> treasureDrafts(
            GenerationRequest request,
            SessionContext context,
            List<EncounterPlan> encounters
    ) {
        int normalCount = context.treasureCount() - 1;
        List<Double> normalTargets = weightedTargets(preciseNormalBudget(request, context), normalCount);
        List<Integer> slots = slotCurve(context.nonMagicSlots(), context.treasureCount());
        List<EncounterPlan> bossOrder = encounters.stream().sorted(Comparator.comparingInt(EncounterPlan::bossRank)).toList();
        Set<Integer> anchored = new HashSet<>();
        boolean questUsed = false;
        List<TreasureDraft> drafts = new ArrayList<>();
        for (int index = 0; index < context.treasureCount(); index++) {
            int id = index + 1;
            String stock = id <= normalCount ? "normal" : "overstock";
            double target = "normal".equals(stock) ? normalTargets.get(index) : context.overstockBudgetCp();
            Channel channel = channel(request.seed(), id, questUsed, anchored.size() < encounters.size());
            Integer anchor = null;
            if (channel == Channel.QUEST) {
                questUsed = true;
            } else if (channel == Channel.ENCOUNTER) {
                anchor = bossOrder.stream().map(EncounterPlan::encounterNumber)
                        .filter(number -> !anchored.contains(number)).findFirst().orElse(null);
                if (anchor == null) {
                    channel = Channel.ENVIRONMENT;
                } else {
                    anchored.add(anchor);
                }
            }
            Theme theme = themes.get((int) Math.floorMod(request.seed() + id * 997L, themes.size()));
            drafts.add(new TreasureDraft(id, stock, channel.value, anchor, theme, target, slots.get(index)));
        }
        return List.copyOf(drafts);
    }

    private LootLine nonMagicLine(
            GenerationRequest request,
            TreasureDraft draft,
            int lineId,
            int slot,
            double availableCp
    ) {
        double roleRoll = unitQuadratic(
                request.seed() + lineId * 1009L + draft.treasureId() * 719L,
                lineId * (long) draft.treasureId() * 2131L);
        String role = roleRoll < 0.60d ? "carrier" : roleRoll < 0.90d ? "useful" : "flavor";
        String form = role;
        if ("carrier".equals(role)) {
            double bulk = Math.floorMod(
                    request.seed() * 7919L + lineId * 104729L + draft.treasureId() * 13007L,
                    1_000_003L) / 1_000_003d;
            double formRoll = unitQuadratic(
                    request.seed() + lineId * 1009L + draft.treasureId() * 2131L,
                    lineId * (long) draft.treasureId() * 2371L);
            form = bulk < 0.25d ? "Bulk_Good" : FORMS.get(Math.min(
                    FORMS.size() - 1, (int) Math.floor(formRoll * FORMS.size())));
        }
        if ("Coinage".equals(form)) {
            return coinLine(lineId, role, availableCp, request.seed(), draft.treasureId());
        }
        if ("Adorned".equals(form)) {
            return adornedLine(request, draft, lineId, availableCp, role);
        }
        Selection selection = selectItem(request, draft, lineId, availableCp, role, form);
        if (selection == null) {
            return new LootLine(lineId, role, "[unresolved]", 0, 0, 0, "none", "", false, "[unresolved]");
        }
        ContainerChoice packing = selectContainer(
                selection.item(), selection.quantity(), lineId, draft.treasureId(), request.seed());
        String text = contentText(selection, packing.count());
        return new LootLine(
                lineId, role, selection.item().name(), selection.quantity(), selection.item().baseCp(),
                selection.actualCp(), packing.reference(), "", false, text);
    }

    private Selection selectItem(
            GenerationRequest request,
            TreasureDraft draft,
            int lineId,
            double availableCp,
            String role,
            String form
    ) {
        List<Selection> candidates = new ArrayList<>();
        for (Item item : items) {
            if (!item.active() || item.baseCp() <= 0 || !role.equals(item.lootClass()) || !matchesForm(item, form, availableCp)) {
                continue;
            }
            int cap = quantityCap(item, role);
            double ideal = availableCp / (double) item.baseCp();
            int floor = Math.max(1, Math.min(cap, (int) Math.floor(ideal)));
            int ceil = Math.max(1, Math.min(cap, (int) Math.ceil(ideal)));
            List<Integer> quantities = floor == ceil ? List.of(floor) : List.of(floor, ceil);
            for (int quantity : quantities) {
                long actual = item.baseCp() * quantity;
                if (actual > availableCp * 1.05d) continue;
                if (!"carrier".equals(role) && actual < availableCp * 0.50d) continue;
                double gap = Math.abs(actual - availableCp);
                double fit = 1d - gap / Math.max(1d, availableCp);
                double themed = relatedToTheme(item.category(), draft.theme().id()) ? 1d : 0d;
                double jitter = unitQuadratic(
                        request.seed() + lineId * 1009L + item.databaseRow() * 719L,
                        draft.treasureId() * (long) item.databaseRow() * 2131L);
                candidates.add(new Selection(item, quantity, actual, gap, fit * 0.8d + themed * 0.1d + jitter * 0.1d));
            }
        }
        double bestGap = candidates.stream().mapToDouble(Selection::gap).min().orElse(Double.MAX_VALUE);
        double tolerance = availableCp * 0.05d;
        return candidates.stream().filter(candidate -> candidate.gap() <= bestGap + tolerance)
                .sorted(Comparator.comparingDouble(Selection::score).reversed()
                        .thenComparingInt(selection -> selection.item().databaseRow()))
                .findFirst().orElse(null);
    }

    private LootLine adornedLine(
            GenerationRequest request,
            TreasureDraft draft,
            int lineId,
            double availableCp,
            String role
    ) {
        List<AdornedBase> bases = new ArrayList<>();
        for (Item item : items) {
            if (!item.active() || item.baseCp() <= 0 || item.modularProfile().isBlank()
                    || "none".equals(item.modularProfile()) || item.allowedContainers().isEmpty()
                    || item.allowedContainers().contains("none") || item.baseCp() > availableCp * 1.05d - 1_000d) {
                continue;
            }
            double estimate = item.baseCp() + (availableCp - item.baseCp() >= 1_500d ? 1_500d : 1_000d);
            double fit = 1d - Math.abs(estimate - availableCp) / Math.max(1d, availableCp);
            double themed = relatedToTheme(item.category(), draft.theme().id()) ? 1d : 0d;
            double jitter = unitQuadratic(
                    request.seed() + lineId * 2131L + item.databaseRow() * 1009L,
                    draft.treasureId() * (long) item.databaseRow() * 2371L);
            bases.add(new AdornedBase(item, fit * 0.8d + themed * 0.1d + jitter * 0.1d));
        }
        AdornedBase selectedBase = bases.stream()
                .sorted(Comparator.comparingDouble(AdornedBase::score).reversed()
                        .thenComparingInt(value -> value.item().databaseRow()))
                .findFirst().orElse(null);
        if (selectedBase == null) return unresolved(lineId, role);

        Item base = selectedBase.item();
        double remaining = availableCp * 1.05d - base.baseCp();
        List<AdornedModifier> modifierCandidates = new ArrayList<>();
        for (int index = 0; index < lootModifiers.size(); index++) {
            Map<String, String> row = lootModifiers.get(index);
            if (!active(row) || !"modular".equals(row.get("Modifier_Kind"))) continue;
            long flat = Math.round(number(row, "Flat_Value_CP"));
            if (flat > remaining || !matchesCsvOrAll(row.get("Allowed_Profiles_Cache"), base.modularProfile())) {
                continue;
            }
            String componentType = row.getOrDefault("Component_Type", "none");
            double estimate = base.baseCp() + flat
                    + ("none".equals(componentType) ? 0d : Math.max(0d, availableCp - base.baseCp() - flat));
            double fit = 1d - Math.abs(estimate - availableCp) / Math.max(1d, availableCp);
            int databaseRow = index + 2;
            double jitter = unitQuadratic(
                    request.seed() + lineId * 2371L + databaseRow * 1009L,
                    draft.treasureId() * (long) databaseRow * 2593L);
            modifierCandidates.add(new AdornedModifier(
                    row, databaseRow, flat, componentType, fit * 0.8d + jitter * 0.2d));
        }
        AdornedModifier modifier = modifierCandidates.stream()
                .sorted(Comparator.comparingDouble(AdornedModifier::score).reversed()
                        .thenComparingInt(AdornedModifier::databaseRow))
                .findFirst().orElse(null);
        if (modifier == null) return unresolved(lineId, role);

        int componentQuantity = 0;
        String componentName = "";
        long componentValue = 0L;
        if (!"none".equals(modifier.componentType())) {
            int minimum = (int) number(modifier.row(), "Min_Qty");
            int maximum = (int) number(modifier.row(), "Max_Qty");
            List<AdornedComponent> components = new ArrayList<>();
            for (Item item : items) {
                if (!item.active() || !item.canAdorn() || item.baseCp() <= 0
                        || !modifier.componentType().equals(item.adornmentType())) continue;
                double raw = (availableCp - base.baseCp() - modifier.flatCp()) / item.baseCp();
                int down = Math.min(maximum, (int) Math.floor(raw));
                int up = Math.min(maximum, (int) Math.ceil(raw));
                int quantity = base.baseCp() + modifier.flatCp() + item.baseCp() * (long) up <= availableCp * 1.05d
                        && Math.abs(base.baseCp() + modifier.flatCp() + item.baseCp() * (long) up - availableCp)
                        < Math.abs(base.baseCp() + modifier.flatCp() + item.baseCp() * (long) down - availableCp)
                        ? up : down;
                long total = base.baseCp() + modifier.flatCp() + item.baseCp() * (long) quantity;
                if (quantity < minimum || total > availableCp * 1.05d) continue;
                double fit = 1d - Math.abs(total - availableCp) / Math.max(1d, availableCp);
                double jitter = unitQuadratic(
                        request.seed() + lineId * 2593L + item.databaseRow() * 1009L,
                        draft.treasureId() * (long) item.databaseRow() * 2371L);
                components.add(new AdornedComponent(item, quantity, fit * 0.9d + jitter * 0.1d));
            }
            AdornedComponent component = components.stream()
                    .sorted(Comparator.comparingDouble(AdornedComponent::score).reversed()
                            .thenComparingInt(value -> value.item().databaseRow()))
                    .findFirst().orElse(null);
            if (component == null) return unresolved(lineId, role);
            componentQuantity = component.quantity();
            componentName = component.item().name();
            componentValue = component.item().baseCp();
        }

        long total = base.baseCp() + modifier.flatCp() + componentValue * componentQuantity;
        String rendered = modifier.row().getOrDefault("Text_Template", "{item}")
                .replace("{item}", base.name())
                .replace("{qty}", Integer.toString(componentQuantity))
                .replace("{component}", componentName);
        ContainerChoice packing = selectContainer(base, 1, lineId, draft.treasureId(), request.seed());
        String text = "1x " + rendered + " [á " + gp(total) + " gp]";
        return new LootLine(lineId, role, rendered, 1, total, total, packing.reference(), "", false, text);
    }

    private static LootLine unresolved(int lineId, String role) {
        return new LootLine(lineId, role, "[unresolved]", 0, 0, 0, "none", "", false, "[unresolved]");
    }

    private LootLine magicLine(
            GenerationRequest request,
            TreasureDraft draft,
            int lineId,
            int magicIndex,
            String rarity
    ) {
        List<MagicItem> typed = magicItems.stream()
                .filter(item -> item.active() && rarity.equals(item.rarity()) && draft.theme().magicType().equals(item.type()))
                .toList();
        List<MagicItem> pool = typed.isEmpty()
                ? magicItems.stream().filter(item -> item.active() && rarity.equals(item.rarity())).toList()
                : typed;
        if (pool.isEmpty()) {
            return new LootLine(lineId, "magic", "[unresolved]", 1, 0, 0, "none", rarity, false, "[unresolved]");
        }
        MagicItem selected = pool.get((int) Math.floorMod(
                request.seed() + magicIndex * 1487L + draft.treasureId() * 1663L, pool.size()));
        String text = resolveMagicText(selected, request.seed(), magicIndex, draft) + " [" + rarity + "]";
        List<Curse> cursePool = curses.stream()
                .filter(curse -> curse.active() && ("all".equals(curse.appliesTo())
                        || draft.theme().magicType().equalsIgnoreCase(curse.appliesTo())))
                .toList();
        double curseRoll = Math.floorMod(
                request.seed() + magicIndex * 2017L + draft.treasureId() * 1487L, 10_000L) / 10_000d;
        boolean cursed = curseRoll < 0.20d && !cursePool.isEmpty();
        if (cursed) {
            int totalWeight = cursePool.stream().mapToInt(Curse::weight).sum();
            int ticket = 1 + (int) Math.floorMod(
                    request.seed() + magicIndex * 2017L + draft.treasureId() * 1663L, totalWeight);
            int cumulative = 0;
            for (Curse curse : cursePool) {
                cumulative += curse.weight();
                if (cumulative >= ticket) {
                    text += " [CURSED — " + curse.name() + ": " + curse.effect() + "]";
                    break;
                }
            }
        }
        return new LootLine(lineId, "magic", selected.item(), 1, 0, 0, "none", rarity, cursed, text);
    }

    private String resolveMagicText(MagicItem item, long seed, int magicIndex, TreasureDraft draft) {
        return switch (item.decisionType()) {
            case "fixed_variant" -> item.item() + (item.info1().isBlank() ? "" : " — " + item.info1());
            case "variant_group" -> item.item() + chooseVariant(item.info1(), seed, magicIndex, draft.treasureId());
            case "spell_level" -> item.item() + chooseSpell(item.info1(), seed, magicIndex, draft);
            case "enspelled_item" -> item.item() + " [unresolved]";
            default -> item.item();
        };
    }

    private String chooseVariant(String group, long seed, int magicIndex, int treasureId) {
        List<Map<String, String>> pool = variants.stream()
                .filter(row -> active(row) && group.equals(row.get("Group_Key")))
                .sorted(Comparator.comparingDouble(row -> number(row, "Sort_Order"))).toList();
        if (pool.isEmpty()) return "";
        Map<String, String> selected = pool.get((int) Math.floorMod(seed + magicIndex * 1663L + treasureId * 1487L, pool.size()));
        return " — " + selected.get("Option");
    }

    private String chooseSpell(String levelText, long seed, int magicIndex, TreasureDraft draft) {
        int level = parseLeadingInt(levelText);
        List<Map<String, String>> levelPool = spells.stream()
                .filter(row -> (int) number(row, "Level") == level).toList();
        List<Map<String, String>> themed = levelPool.stream()
                .filter(row -> containsAny(row.get("Elements"), draft.theme().spellColors())).toList();
        List<Map<String, String>> pool = themed.isEmpty() ? levelPool : themed;
        if (pool.isEmpty()) return " [unresolved]";
        return " — " + pool.get((int) Math.floorMod(
                seed + magicIndex * 1889L + draft.treasureId() * 1487L, pool.size())).get("Spell");
    }

    private LootLine coinLine(int lineId, String role, double availableCp, long seed, int treasureId) {
        long roundedAvailable = Math.round(availableCp);
        long gp = Math.max(1L, roundedAvailable / 100L);
        long remainder = Math.max(5L, roundedAvailable - gp * 100L);
        if (gp * 100L + remainder > Math.round(availableCp * 1.05d)) {
            gp = Math.max(0L, gp - 1L);
        }
        long actual = gp * 100L + remainder;
        String text = gp + " Gold Coins, " + remainder + " Copper Coins";
        return new LootLine(lineId, role, "Coins", (int) Math.min(Integer.MAX_VALUE, gp + remainder), 1, actual,
                "Pouch", "", false, text);
    }

    private ContainerChoice selectContainer(Item item, int quantity, int lineId, int treasureId, long seed) {
        double totalCapacity = item.capacity() * quantity;
        if (item.allowedContainers().isEmpty() || totalCapacity <= 0
                || (quantity <= 1 && ("worn".equals(item.placement()) || "handheld".equals(item.placement())
                        || (!MEASURED.matcher(item.name()).matches() && item.capacity() >= 2d)))) {
            return ContainerChoice.none();
        }
        List<String> options = new ArrayList<>(item.allowedContainers());
        if (quantity >= 5 && !isLiquid(item.name())) options.add("Pile");
        List<ContainerChoice> choices = new ArrayList<>();
        for (String option : options) {
            if ("Pile".equals(option)) {
                choices.add(new ContainerChoice(option, 1, 1d, false));
                continue;
            }
            Container container = containers.get(option);
            if (container == null || container.capacity() <= 0) continue;
            int count = Math.max(1, (int) Math.ceil(totalCapacity / container.capacity()));
            double fill = totalCapacity / (count * container.capacity());
            choices.add(new ContainerChoice(option, count, fill, container.hidden()));
        }
        if (choices.isEmpty()) return ContainerChoice.none();
        int minimum = choices.stream().mapToInt(ContainerChoice::count).min().orElse(1);
        List<ContainerChoice> eligible = choices.stream()
                .filter(choice -> choice.count() <= minimum * 4 && choice.fill() >= 0.25d).toList();
        List<ContainerChoice> pool = eligible.isEmpty()
                ? choices.stream().filter(choice -> choice.fill() == choices.stream()
                        .mapToDouble(ContainerChoice::fill).max().orElse(0d)).toList()
                : eligible;
        ContainerChoice chosen = pool.get((int) Math.floorMod(seed + lineId * 113L + treasureId * 1009L, pool.size()));
        return chosen.hidden() ? ContainerChoice.none() : chosen;
    }

    private static String contentText(Selection selection, int containerCount) {
        Item item = selection.item();
        if (MEASURED.matcher(item.name()).matches()) {
            int divisor = Math.max(1, containerCount);
            String cleanName = item.name().replaceFirst("(?i) \\((?:lb(?:/sq yd)?|pint|fl oz)\\)$", "");
            double weight = item.baseLb() * selection.quantity() / divisor;
            double actualGp = selection.actualCp() / 100d / divisor;
            return cleanName + " [á " + amount(weight) + " lb, " + amount(actualGp) + " gp]";
        }
        return selection.quantity() + "x " + item.name() + " [á " + gp(item.baseCp()) + " gp]";
    }

    private double preciseNormalBudget(GenerationRequest request, SessionContext context) {
        BigDecimal weightedGoldRate = BigDecimal.ZERO;
        List<Map<String, String>> progression = catalog.table("DB_Progression");
        for (Map.Entry<Integer, Integer> entry : request.playersByLevel().entrySet()) {
            Map<String, String> row = progression.stream()
                    .filter(value -> (int) number(value, "Level") == entry.getKey())
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Missing progression level " + entry.getKey()));
            weightedGoldRate = weightedGoldRate.add(
                    BigDecimal.valueOf(number(row, "Gold_Per_XP")).multiply(BigDecimal.valueOf(entry.getValue())));
        }
        return BigDecimal.valueOf(context.sessionXpTarget())
                .divide(BigDecimal.valueOf(Math.max(1, context.partyCount())), 12, RoundingMode.HALF_UP)
                .multiply(weightedGoldRate)
                .multiply(BigDecimal.valueOf(100))
                .doubleValue();
    }

    private static List<Double> weightedTargets(double pool, int count) {
        if (count <= 0) return List.of();
        List<Double> weights = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            weights.add(1.2d - 0.4d * index / Math.max(1d, count - 1d));
        }
        double total = weights.stream().mapToDouble(Double::doubleValue).sum();
        List<Double> targets = new ArrayList<>();
        double assigned = 0d;
        for (int index = 0; index < count; index++) {
            double target = index == count - 1 ? pool - assigned : Math.round(pool * weights.get(index) / total);
            targets.add(target);
            assigned += target;
        }
        return targets;
    }

    private static List<Integer> slotCurve(int totalSlots, int treasureCount) {
        int remaining = Math.max(0, totalSlots - treasureCount);
        int weightSum = treasureCount * (treasureCount + 1) / 2;
        List<Integer> extras = new ArrayList<>();
        int assigned = 0;
        for (int index = 0; index < treasureCount; index++) {
            int extra = remaining * (treasureCount - index) / Math.max(1, weightSum);
            extras.add(extra);
            assigned += extra;
        }
        for (int index = 0; assigned < remaining; index = (index + 1) % treasureCount) {
            extras.set(index, extras.get(index) + 1);
            assigned++;
        }
        return extras.stream().map(extra -> extra + 1).toList();
    }

    private Channel channel(long seed, int treasureId, boolean questUsed, boolean encounterAvailable) {
        double quest = questUsed ? 0d : 0.4d;
        double encounter = encounterAvailable ? 0.4d : 0d;
        double environment = 0.2d;
        double total = quest + encounter + environment;
        double roll = Math.floorMod(seed + treasureId * 719L, 10_000L) / 10_000d * total;
        if (roll < quest) return Channel.QUEST;
        if (roll < quest + encounter) return Channel.ENCOUNTER;
        return Channel.ENVIRONMENT;
    }

    private String format(List<EncounterPlan> encounters, List<TreasureResult> treasures, RewardSummary summary) {
        StringBuilder output = new StringBuilder();
        output.append("Rewards: ").append(gp(summary.normalActualCp())).append(" gp");
        if (summary.overstockActualCp() > 0) output.append(" + ").append(gp(summary.overstockActualCp())).append(" gp Overstock");
        output.append("\nMagic Items: ").append(summary.magicCount() == 0 ? "0" : summary.magicCount() + " [" + String.join(", ", summary.rarities()) + "]");
        output.append("\n\nQUEST REWARD\n");
        appendSectionTreasures(output,
                treasures.stream().filter(value -> "quest".equals(value.rewardChannel())).toList(), false);
        for (EncounterPlan encounter : encounters) {
            List<TreasureResult> anchored = treasures.stream()
                    .filter(value -> value.anchorEncounterNumber() != null
                            && value.anchorEncounterNumber() == encounter.encounterNumber()).toList();
            output.append("\n").append(encounter.encounterNumber()).append(". ").append(encounter.line())
                    .append("\n   Loot");
            if (anchored.stream().anyMatch(value -> "overstock".equals(value.stockClass()))) {
                output.append(" [Overstock]");
            }
            output.append("\n");
            if (anchored.isEmpty()) {
                output.append("   —\n");
            } else {
                anchored.forEach(value -> appendTreasureContent(output, value));
            }
        }
        output.append("\nENVIRONMENTAL REWARDS\n");
        appendSectionTreasures(output,
                treasures.stream().filter(value -> "environment".equals(value.rewardChannel())).toList(), true);
        return output.toString().stripTrailing();
    }

    private static void appendSectionTreasures(
            StringBuilder output,
            List<TreasureResult> treasures,
            boolean showOverstockLabel
    ) {
        if (treasures.isEmpty()) {
            output.append("—\n");
            return;
        }
        for (TreasureResult treasure : treasures) {
            if (showOverstockLabel && "overstock".equals(treasure.stockClass())) output.append("Overstock\n");
            appendTreasureContent(output, treasure);
        }
    }

    private static void appendTreasureContent(StringBuilder output, TreasureResult treasure) {
        Set<String> emittedContainers = new HashSet<>();
        for (LootLine line : treasure.loot()) {
            if (line.container() == null || "none".equals(line.container())) {
                output.append("   ").append(line.text()).append("\n");
                continue;
            }
            if (!emittedContainers.add(line.container())) continue;
            java.util.regex.Matcher matcher = Pattern.compile("^(.+) 1(?:-(\\d+))?$").matcher(line.container());
            if (!matcher.matches()) {
                output.append("   ").append(line.text()).append("\n");
                continue;
            }
            String type = matcher.group(1);
            int count = matcher.group(2) == null ? 1 : Integer.parseInt(matcher.group(2));
            if (count == 1) {
                output.append("   A ").append(type).append("Pile".equals(type) ? " of:\n" : " with:\n");
            } else {
                output.append("   ").append(count).append(" ").append(plural(type))
                        .append("Pile".equals(type) ? " of:\n" : " with:\n");
            }
            treasure.loot().stream().filter(value -> line.container().equals(value.container()))
                    .forEach(value -> output.append("      ").append(value.text()).append("\n"));
        }
    }

    private static String plural(String type) {
        return switch (type) {
            case "Pouch" -> "Pouches";
            case "Chest" -> "Chests";
            default -> type + "s";
        };
    }

    private List<Item> loadItems() {
        List<Item> result = new ArrayList<>();
        int databaseRow = 2;
        for (Map<String, String> row : catalog.table("DB_LootItems")) {
            result.add(new Item(
                    row.get("Item_ID"), row.get("Name"), row.get("Category"), Math.round(number(row, "Base_CP")),
                    number(row, "Base_LB"), active(row), row.get("Loot_Form_Override"),
                    number(row, "Capacity_Units"), csv(row.get("Allowed_Containers_Cache")),
                    row.get("Loot_Class"), row.get("Loot_Type"), row.get("Value_Form"),
                    row.getOrDefault("Modular_Profile_Cache", ""),
                    Boolean.parseBoolean(row.getOrDefault("Can_Adorn", "false")),
                    row.getOrDefault("Adornment_Type", ""),
                    databaseRow++));
        }
        return List.copyOf(result);
    }

    private List<Theme> loadThemes() {
        return catalog.table("DB_Themes").stream().filter(SheetV1LootGenerator::active)
                .map(row -> new Theme(
                        row.get("Theme_ID"), row.get("Theme"), row.get("Magic_Type"), csv(row.get("Spell_Colors"))))
                .toList();
    }

    private List<MagicItem> loadMagicItems() {
        return catalog.table("DB_MagicItems").stream()
                .map(row -> new MagicItem(row.get("Type"), row.get("Rarity"), row.get("Item"),
                        row.get("Decision_Type"), row.get("Info_1"), row.get("Info_2"), active(row))).toList();
    }

    private List<Curse> loadCurses() {
        return catalog.table("DB_MagicCurses").stream()
                .map(row -> new Curse(row.get("Name"), row.get("Effect"), Math.max(1, (int) number(row, "Weight")),
                        row.get("Applies_To"), active(row))).toList();
    }

    private Map<String, Container> loadContainers() {
        Map<String, Container> result = new LinkedHashMap<>();
        for (Map<String, String> row : catalog.table("DB_Containers")) {
            result.put(row.get("Container"), new Container(
                    number(row, "Capacity_Units"), Boolean.parseBoolean(row.get("Hide_In_Output"))));
        }
        return Map.copyOf(result);
    }

    private boolean relatedToTheme(String category, String themeId) {
        return catalog.table("DB_LootRelations").stream().anyMatch(row -> active(row)
                && "THEME_CATEGORY".equals(row.get("Relation_Type"))
                && themeId.equalsIgnoreCase(row.get("Source_ID"))
                && category.equalsIgnoreCase(row.get("Target_ID")));
    }

    private static boolean matchesForm(Item item, String form, double availableCp) {
        if (!"carrier".equals(item.lootClass())) return true;
        boolean quantityGood = "Quantity_Good".equals(item.valueForm());
        double quantity = item.baseCp() <= 0 ? 0 : availableCp / (double) item.baseCp();
        boolean contextBulk = quantity * item.baseLb() >= 20d;
        return switch (form) {
            case "Bulk_Good" -> quantityGood && contextBulk;
            case "Compact_Good" -> quantityGood && !contextBulk;
            case "Ingot", "Art_Object", "Gemstone", "Livestock", "Clothing" -> form.equals(item.category());
            case "Adorned" -> false;
            default -> true;
        };
    }

    private static int quantityCap(Item item, String role) {
        if (MEASURED.matcher(item.name()).matches()) return 10_000;
        if ("carrier".equals(role)) {
            return switch (item.category()) {
                case "Art_Object" -> 3;
                case "Gemstone" -> 10;
                case "Ingot" -> 20;
                case "Trade_Good" -> 250;
                default -> 50;
            };
        }
        if ("flavor".equals(role)) return 50;
        if ("Ammunition".equals(item.category())) return 20;
        if (Set.of("Potion", "Poison", "Hazard_Item").contains(item.category())) return 3;
        return 1;
    }

    private static List<String> rarityList(List<RarityTarget> targets, boolean overstock) {
        Map<String, RarityTarget> byName = new LinkedHashMap<>();
        targets.forEach(target -> byName.put(target.rarity(), target));
        List<String> result = new ArrayList<>();
        for (String rarity : RARITY_PRIORITY) {
            RarityTarget target = byName.get(rarity);
            int count = target == null ? 0 : overstock ? target.overstockCount() : target.normalCount();
            for (int index = 0; index < count; index++) result.add(rarity);
        }
        return result;
    }

    private static boolean containsAny(String csv, List<String> values) {
        Set<String> actual = new HashSet<>(SheetV1LootGenerator.csv(csv));
        return values.stream().anyMatch(actual::contains);
    }

    private static List<String> csv(String value) {
        if (value == null || value.isBlank()) return List.of();
        return java.util.Arrays.stream(value.split(",")).map(String::trim).filter(part -> !part.isBlank()).toList();
    }

    private static boolean matchesCsvOrAll(String values, String target) {
        List<String> options = csv(values);
        return options.contains("all") || options.contains(target);
    }

    private static boolean active(Map<String, String> row) {
        return Boolean.parseBoolean(row.getOrDefault("Active", "false"));
    }

    private static double number(Map<String, String> row, String column) {
        String value = row.getOrDefault(column, "");
        return value.isBlank() ? 0d : Double.parseDouble(value);
    }

    private static double unitQuadratic(long base, long cross) {
        java.math.BigInteger value = java.math.BigInteger.valueOf(base).multiply(java.math.BigInteger.valueOf(base))
                .add(java.math.BigInteger.valueOf(cross));
        return value.mod(java.math.BigInteger.valueOf(1_000_003L)).doubleValue() / 1_000_003d;
    }

    private static boolean isLiquid(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.contains("(pint)") || lower.contains("(fl oz)");
    }

    private static int parseLeadingInt(String text) {
        if (text == null) return 0;
        java.util.regex.Matcher matcher = Pattern.compile("-?\\d+").matcher(text);
        return matcher.find() ? Integer.parseInt(matcher.group()) : 0;
    }

    private static String gp(long cp) {
        BigDecimal gp = BigDecimal.valueOf(cp).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP).stripTrailingZeros();
        NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
        format.setGroupingUsed(false);
        format.setMaximumFractionDigits(2);
        return format.format(gp);
    }

    private static String amount(double value) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.GERMANY);
        format.setGroupingUsed(false);
        format.setMinimumFractionDigits(0);
        format.setMaximumFractionDigits(value < 1d ? 2 : value < 10d ? 1 : 0);
        return format.format(value);
    }

    record LootOutput(List<TreasureResult> treasures, RewardSummary summary, String formattedText) {
    }

    private enum Channel {
        QUEST("quest"), ENCOUNTER("encounter"), ENVIRONMENT("environment");
        private final String value;
        Channel(String value) { this.value = value; }
    }

    private record TreasureDraft(
            int treasureId, String stockClass, String rewardChannel, Integer anchorEncounterNumber,
            Theme theme, double targetCp, int nonMagicSlots
    ) {
        TreasureDraft(int treasureId, String stockClass, Channel channel, Integer anchorEncounterNumber,
                Theme theme, double targetCp, int nonMagicSlots) {
            this(treasureId, stockClass, channel.value, anchorEncounterNumber, theme, targetCp, nonMagicSlots);
        }
    }

    private record Theme(String id, String name, String magicType, List<String> spellColors) {
    }

    private record Item(
            String id, String name, String category, long baseCp, double baseLb, boolean active, String placement,
            double capacity, List<String> allowedContainers, String lootClass, String lootType, String valueForm,
            String modularProfile, boolean canAdorn, String adornmentType,
            int databaseRow
    ) {
    }

    private record MagicItem(
            String type, String rarity, String item, String decisionType, String info1, String info2, boolean active
    ) {
    }

    private record Curse(String name, String effect, int weight, String appliesTo, boolean active) {
    }

    private record Container(double capacity, boolean hidden) {
    }

    private record Selection(Item item, int quantity, long actualCp, double gap, double score) {
    }

    private record AdornedBase(Item item, double score) {
    }

    private record AdornedModifier(
            Map<String, String> row,
            int databaseRow,
            long flatCp,
            String componentType,
            double score
    ) {
    }

    private record AdornedComponent(Item item, int quantity, double score) {
    }

    private record ContainerChoice(String name, int count, double fill, boolean hidden) {
        static ContainerChoice none() {
            return new ContainerChoice("none", 0, 0d, false);
        }

        String reference() {
            if ("none".equals(name)) return "none";
            return count <= 1 ? name + " 1" : name + " 1-" + count;
        }
    }
}
