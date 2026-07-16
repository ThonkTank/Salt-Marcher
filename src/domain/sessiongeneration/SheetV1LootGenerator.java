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
    private static final List<CoinProfile> COIN_PROFILES = List.of(
            new CoinProfile("pp_gp", 1000, 100, 0, Long.MAX_VALUE, "Platinum", "Gold", ""),
            new CoinProfile("gp_ep", 100, 50, 0, Long.MAX_VALUE, "Gold", "Electrum", ""),
            new CoinProfile("gp_sp", 100, 10, 0, Long.MAX_VALUE, "Gold", "Silver", ""),
            new CoinProfile("ep_sp", 50, 10, 0, 5_000, "Electrum", "Silver", ""),
            new CoinProfile("sp_cp", 10, 1, 0, 2_000, "Silver", "Copper", ""),
            new CoinProfile("pp_gp_ep", 1000, 100, 50, Long.MAX_VALUE, "Platinum", "Gold", "Electrum"),
            new CoinProfile("pp_gp_sp", 1000, 100, 10, Long.MAX_VALUE, "Platinum", "Gold", "Silver"),
            new CoinProfile("gp_ep_sp", 100, 50, 10, 20_000, "Gold", "Electrum", "Silver"),
            new CoinProfile("ep_sp_cp", 50, 10, 1, 5_000, "Electrum", "Silver", "Copper"));
    private static final Pattern MEASURED = Pattern.compile(".*(\\(lb\\)|\\(lb/sq yd\\)|\\(pint\\)|\\(fl oz\\)).*", Pattern.CASE_INSENSITIVE);

    private final SessionGenerationCatalog catalog;
    private final List<Item> items;
    private final List<Theme> themes;
    private final List<MagicItem> magicItems;
    private final List<Map<String, String>> lootModifiers;
    private final List<Map<String, String>> variants;
    private final List<Map<String, String>> spells;
    private final List<Map<String, String>> enspelledRules;
    private final Set<String> activeDecisionTypes;
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
        enspelledRules = catalog.table("DB_EnspelledRules");
        activeDecisionTypes = catalog.table("DB_MagicDecisionTypes").stream()
                .filter(SheetV1LootGenerator::active)
                .map(row -> row.get("Decision_Type"))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        curses = loadCurses();
        containers = loadContainers();
    }

    LootOutput generate(GenerationRequest request, SessionContext context, List<EncounterPlan> encounters) {
        List<TreasureDraft> drafts = treasureDrafts(request, context, encounters);
        Map<Integer, List<BuiltLine>> linesByTreasure = new LinkedHashMap<>();
        int lineId = 1;
        for (TreasureDraft draft : drafts) {
            List<BuiltLine> lines = new ArrayList<>();
            long spent = 0L;
            for (int slot = 1; slot <= draft.nonMagicSlots(); slot++) {
                double available = Math.max(0d, (draft.targetCp() - spent) / (draft.nonMagicSlots() - slot + 1d));
                BuiltLine line = nonMagicLine(request, draft, lineId++, slot, available);
                lines.add(line);
                spent += line.line().actualCp();
            }
            linesByTreasure.put(draft.treasureId(), lines);
        }

        List<String> normalRarities = rarityList(context.rarityTargets(), false);
        List<String> overstockRarities = rarityList(context.rarityTargets(), true);
        int globalMagicIndex = 0;
        List<TreasureDraft> normalDrafts = drafts.stream()
                .filter(draft -> "normal".equals(draft.stockClass())).toList();
        for (int index = 0; index < normalRarities.size(); index++) {
            TreasureDraft draft = normalDrafts.get(index % normalDrafts.size());
            linesByTreasure.get(draft.treasureId())
                    .add(magicLine(request, draft, lineId++, ++globalMagicIndex, normalRarities.get(index)));
        }
        List<TreasureDraft> overstockDrafts = drafts.stream()
                .filter(draft -> "overstock".equals(draft.stockClass())).toList();
        for (int index = 0; index < overstockRarities.size(); index++) {
            TreasureDraft draft = overstockDrafts.get(index % overstockDrafts.size());
            linesByTreasure.get(draft.treasureId())
                    .add(magicLine(request, draft, lineId++, ++globalMagicIndex, overstockRarities.get(index)));
        }

        List<TreasureResult> results = new ArrayList<>();
        List<LineAudit> lineAudits = new ArrayList<>();
        for (TreasureDraft draft : drafts) {
            List<BuiltLine> builtLines = linesByTreasure.get(draft.treasureId());
            List<LootLine> lines = packTreasure(builtLines);
            builtLines.forEach(line -> lineAudits.add(line.audit()));
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
        LootDiagnostics diagnostics = diagnostics(drafts, results, lineAudits);
        return new LootOutput(List.copyOf(results), summary, format(encounters, results, summary), diagnostics);
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

    private BuiltLine nonMagicLine(
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
            return unresolved(lineId, role, availableCp);
        }
        if ("useful".equals(role)) selection = applyUsefulVariant(request, draft, lineId, availableCp, selection);
        ContainerChoice packing = selectContainer(
                selection.item(), selection.quantity(), lineId, draft.treasureId(), request.seed());
        String label = selection.modifier().isBlank()
                ? selection.item().name() : selection.modifier() + " " + selection.item().name();
        String text = rawLootText(selection, label);
        LootLine line = new LootLine(
                lineId, role, label, selection.quantity(), selection.unitCp(),
                selection.actualCp(), packing.name(), "", false, text);
        return builtLine(line, selection.item(), packing, availableCp, true, selection.item().id(), "");
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
                candidates.add(new Selection(
                        item, "", quantity, item.baseCp(), actual, gap,
                        fit * 0.8d + themed * 0.1d + jitter * 0.1d));
            }
        }
        double bestGap = candidates.stream().mapToDouble(Selection::gap).min().orElse(Double.MAX_VALUE);
        double tolerance = availableCp * 0.05d;
        return candidates.stream().filter(candidate -> candidate.gap() <= bestGap + tolerance)
                .sorted(Comparator.comparingDouble(Selection::score).reversed()
                        .thenComparingInt(selection -> selection.item().databaseRow()))
                .findFirst().orElse(null);
    }

    private Selection applyUsefulVariant(
            GenerationRequest request,
            TreasureDraft draft,
            int lineId,
            double availableCp,
            Selection base
    ) {
        List<VariantSelection> candidates = new ArrayList<>();
        for (int index = 0; index < lootModifiers.size(); index++) {
            Map<String, String> row = lootModifiers.get(index);
            if (!active(row) || !"variant".equals(row.get("Modifier_Kind"))) continue;
            long add = Math.round(number(row, "Flat_Value_CP"));
            long actual = (base.item().baseCp() + add) * base.quantity();
            if (add <= 0L || actual > availableCp * 1.05d
                    || !matchesValueOrAll(row.get("Loot_Type"), base.item().lootType())
                    || !matchesCsvOrAll(row.get("Allowed_Profiles_Cache"), base.item().modularProfile())
                    || !matchesCsvOrAll(row.get("Allowed_Categories_Cache"), base.item().category())) {
                continue;
            }
            int databaseRow = index + 2;
            double jitter = unitQuadratic(
                    request.seed() + lineId * 2371L + databaseRow * 719L,
                    draft.treasureId() * (long) databaseRow * 2131L);
            candidates.add(new VariantSelection(row.get("Name"), add, actual,
                    Math.abs(actual - availableCp), jitter, databaseRow));
        }
        VariantSelection selected = candidates.stream()
                .sorted(Comparator.comparingDouble(VariantSelection::gap)
                        .thenComparing(Comparator.comparingDouble(VariantSelection::jitter).reversed())
                        .thenComparingInt(VariantSelection::databaseRow))
                .findFirst().orElse(null);
        if (selected == null) return base;
        long unitCp = base.item().baseCp() + selected.addCp();
        return new Selection(
                base.item(), selected.name(), base.quantity(), unitCp, selected.actualCp(),
                selected.gap(), base.score());
    }

    private BuiltLine adornedLine(
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
        if (selectedBase == null) return unresolved(lineId, role, availableCp);

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
        if (modifier == null) return unresolved(lineId, role, availableCp);

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
            if (component == null) return unresolved(lineId, role, availableCp);
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
        LootLine line = new LootLine(lineId, role, rendered, 1, total, total, packing.name(), "", false, text);
        return builtLine(line, base, packing, availableCp, true, base.id(), "");
    }

    private static BuiltLine unresolved(int lineId, String role, double availableCp) {
        LootLine line = new LootLine(
                lineId, role, "[unresolved]", 0, 0, 0, "none", "", false, "[unresolved]");
        return new BuiltLine(line, PackingData.none(),
                new LineAudit(lineId, true, availableCp, 0L, true, false, ""), "");
    }

    private BuiltLine magicLine(
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
            LootLine line = new LootLine(
                    lineId, "magic", "[unresolved]", 1, 0, 0, "none", rarity, false, "[unresolved]");
            return new BuiltLine(line, PackingData.none(),
                    new LineAudit(lineId, false, 0d, 0L, true, false, ""), "");
        }
        MagicItem selected = pool.get((int) Math.floorMod(
                request.seed() + magicIndex * 1487L + draft.treasureId() * 1663L, pool.size()));
        MagicResolution resolution = resolveMagic(selected, rarity, request.seed(), magicIndex, draft);
        String text = resolution.text();
        List<Curse> cursePool = curses.stream()
                .filter(curse -> curse.active() && ("all".equals(curse.appliesTo())
                        || resolution.curseContext().equalsIgnoreCase(curse.appliesTo())))
                .toList();
        double curseRoll = Math.floorMod(
                request.seed() + magicIndex * 2017L + draft.treasureId() * 1487L, 10_000L) / 10_000d;
        boolean cursed = curseRoll < 0.20d && !cursePool.isEmpty();
        String curseId = "";
        if (cursed) {
            int totalWeight = cursePool.stream().mapToInt(Curse::weight).sum();
            int ticket = 1 + (int) Math.floorMod(
                    request.seed() + magicIndex * 2017L + draft.treasureId() * 1663L, totalWeight);
            int cumulative = 0;
            for (Curse curse : cursePool) {
                cumulative += curse.weight();
                if (cumulative >= ticket) {
                    curseId = curse.id();
                    text += " [CURSED — " + curse.name() + ": "
                            + (curse.requiresAttunement() ? "requires attunement; " : "")
                            + curse.effect() + "]";
                    break;
                }
            }
        }
        text += " [" + rarity + "]";
        LootLine line = new LootLine(
                lineId, "magic", resolution.text(), 1, 0, 0, "none", rarity, cursed, text,
                resolution.baseItemId(), resolution.magicSource(), curseId);
        return new BuiltLine(line, PackingData.none(), new LineAudit(
                lineId, false, 0d, 0L, true, resolution.resolved(), resolution.baseItemId()), "");
    }

    private MagicResolution resolveMagic(
            MagicItem item,
            String rarity,
            long seed,
            int magicIndex,
            TreasureDraft draft
    ) {
        String decision = activeDecisionTypes.contains(item.decisionType()) ? item.decisionType() : "none";
        String text = switch (decision) {
            case "fixed_variant" -> item.item() + (item.info1().isBlank() ? "" : " — " + item.info1());
            case "variant_group" -> item.item() + chooseVariant(item.info1(), seed, magicIndex, draft.treasureId());
            case "spell_level" -> item.item() + chooseSpell(
                    item.info1(), item.info2(), seed, magicIndex, draft, 1487L);
            default -> item.item();
        };
        if (!"enspelled_item".equals(decision)) {
            return new MagicResolution(
                    text, draft.theme().magicType(), "", "curated", !text.contains("[unresolved]"));
        }
        return resolveEnspelled(item, rarity, seed, magicIndex, draft);
    }

    private String chooseVariant(String group, long seed, int magicIndex, int treasureId) {
        List<Map<String, String>> pool = variants.stream()
                .filter(row -> active(row) && group.equals(row.get("Group_Key")))
                .sorted(Comparator.comparingDouble(row -> number(row, "Sort_Order"))).toList();
        if (pool.isEmpty()) return "";
        Map<String, String> selected = pool.get((int) Math.floorMod(seed + magicIndex * 1663L + treasureId * 1487L, pool.size()));
        return " — " + selected.get("Option");
    }

    private String chooseSpell(
            String minimumText,
            String maximumText,
            long seed,
            int magicIndex,
            TreasureDraft draft,
            long treasureMultiplier
    ) {
        int minimum = parseLeadingInt(minimumText);
        int maximum = maximumText == null || maximumText.isBlank() ? minimum : parseLeadingInt(maximumText);
        List<Map<String, String>> levelPool = spells.stream()
                .filter(row -> (int) number(row, "Level") >= minimum && (int) number(row, "Level") <= maximum)
                .toList();
        List<Map<String, String>> themed = levelPool.stream()
                .filter(row -> containsAny(row.get("Elements"), draft.theme().spellColors())).toList();
        List<Map<String, String>> pool = themed.isEmpty() ? levelPool : themed;
        if (pool.isEmpty()) return " [unresolved]";
        return " — " + pool.get((int) Math.floorMod(
                seed + magicIndex * 1889L + draft.treasureId() * treasureMultiplier, pool.size())).get("Spell");
    }

    private MagicResolution resolveEnspelled(
            MagicItem item,
            String rarity,
            long seed,
            int magicIndex,
            TreasureDraft draft
    ) {
        List<Map<String, String>> rules = enspelledRules.stream()
                .filter(row -> active(row) && item.info1().equals(row.get("Chassis"))
                        && rarity.equals(row.get("Rarity")))
                .toList();
        if (rules.isEmpty()) return unresolvedMagic(item, draft);
        Map<String, String> rule = rules.get((int) Math.floorMod(
                seed + magicIndex * 1889L + draft.treasureId() * 1487L, rules.size()));
        int spellLevel = (int) number(rule, "Spell_Level");
        String spellDetail = chooseSpell(
                Integer.toString(spellLevel), Integer.toString(spellLevel),
                seed, magicIndex, draft, 1663L);
        if (spellDetail.contains("[unresolved]")) return unresolvedMagic(item, draft);
        String spell = spellDetail.substring(" — ".length());
        String basePattern = rule.getOrDefault("Base_Item_Regex", "");
        double maxCapacity = number(rule, "Max_Base_Capacity");
        List<Item> basePool;
        try {
            Pattern pattern = Pattern.compile(basePattern);
            basePool = items.stream()
                    .filter(base -> base.active() && "object".equals(base.lootType()))
                    .filter(base -> pattern.matcher(base.name() + " " + base.category()).find())
                    .filter(base -> maxCapacity <= 0d || base.capacity() <= maxCapacity)
                    .toList();
        } catch (java.util.regex.PatternSyntaxException exception) {
            return unresolvedMagic(item, draft);
        }
        if (basePool.isEmpty()) return unresolvedMagic(item, draft);
        Item base = basePool.get((int) Math.floorMod(
                seed + magicIndex * 1487L + draft.treasureId() * 1889L, basePool.size()));
        String text = "Enspelled " + base.name() + " — " + spell
                + " (" + whole(rule, "Max_Charges") + " charges; regains " + rule.get("Recharge")
                + " at dawn; DC " + whole(rule, "Save_DC") + "/+" + whole(rule, "Attack_Bonus") + ")";
        return new MagicResolution(text, base.category(), base.id(), "enspelled", true);
    }

    private static MagicResolution unresolvedMagic(MagicItem item, TreasureDraft draft) {
        return new MagicResolution(
                item.item() + " [unresolved]", draft.theme().magicType(), "", "enspelled", false);
    }

    private BuiltLine coinLine(int lineId, String role, double availableCp, long seed, int treasureId) {
        long changeRoll = quadraticMod(
                seed + lineId * 719L + treasureId * 1009L,
                lineId * (long) treasureId * 2131L);
        List<CoinProfile> eligible = COIN_PROFILES.stream()
                .filter(profile -> profile.minimumValue() <= availableCp * 1.05d
                        && availableCp <= profile.maximumBudget())
                .toList();
        List<CoinProfile> pool = eligible.isEmpty()
                ? COIN_PROFILES.stream().filter(profile -> "sp_cp".equals(profile.name())).toList()
                : eligible;
        CoinProfile profile = pool.get((int) Math.floorMod(changeRoll / 31L, pool.size()));
        boolean hasThird = profile.lowUnit() > 0L;
        long lowUnit = hasThird ? profile.lowUnit() : profile.middleUnit();
        long maxLow = Math.max(5L, Math.min(30L, (long) Math.floor(
                (availableCp * 1.05d - profile.highUnit() - (hasThird ? profile.middleUnit() : 0L)) / lowUnit)));
        long lowCount = 5L + Math.floorMod(changeRoll, Math.max(1L, maxLow - 4L));
        long maxMiddle = hasThird
                ? Math.max(1L, Math.min(300L, (long) Math.floor(
                        (availableCp * 1.05d - profile.highUnit() - lowCount * profile.lowUnit())
                                / profile.middleUnit())))
                : 0L;
        long middleCount = hasThird ? 1L + Math.floorMod(changeRoll / 37L, maxMiddle) : 0L;
        long highCount = Math.max(1L, (long) Math.floor(
                (availableCp - middleCount * profile.middleUnit() - lowCount * lowUnit) / profile.highUnit()));
        long coinBase = highCount * profile.highUnit() + middleCount * profile.middleUnit() + lowCount * lowUnit;
        long finalLow = coinBase == Math.round(availableCp)
                ? lowCount < maxLow ? lowCount + 1L : lowCount > 5L ? lowCount - 1L : lowCount + 1L
                : lowCount;
        long actual = highCount * profile.highUnit() + middleCount * profile.middleUnit() + finalLow * lowUnit;
        String text = coinText(profile, highCount, middleCount, finalLow);
        double capacity = Math.max(0.01d, Math.ceil(actual / 100d) / 50d);
        PackingData packingData = PackingData.coin(capacity);
        ContainerChoice packing = selectContainer(packingData, lineId, treasureId, seed);
        LootLine line = new LootLine(lineId, role, "Coins", 1, actual, actual, packing.name(), "", false, text);
        return new BuiltLine(line, packingData.withChoice(packing),
                new LineAudit(lineId, true, availableCp, actual, packing.valid(), true, "Coins"), text);
    }

    private ContainerChoice selectContainer(Item item, int quantity, int lineId, int treasureId, long seed) {
        return selectContainer(PackingData.item(item, quantity), lineId, treasureId, seed);
    }

    private ContainerChoice selectContainer(PackingData data, int lineId, int treasureId, long seed) {
        if (data.allowedContainers().isEmpty() || data.totalCapacity() <= 0d || data.loose()) {
            return ContainerChoice.none();
        }
        List<String> options = new ArrayList<>(data.allowedContainers());
        if (data.quantity() >= 5 && !data.liquid()) options.add("Pile");
        List<ContainerChoice> choices = new ArrayList<>();
        for (String option : options) {
            Container container = containers.get(option);
            if (container == null || container.capacity() <= 0) continue;
            int count = Math.max(1, (int) Math.ceil(data.totalCapacity() / container.capacity()));
            double fill = data.totalCapacity() / (count * container.capacity());
            choices.add(new ContainerChoice(
                    option, count, fill, container.hidden(), container.capacity(),
                    data.allowedContainers().contains(option)
                            || ("Pile".equals(option) && data.quantity() >= 5 && !data.liquid())));
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

    private static String rawLootText(Selection selection, String label) {
        Item item = selection.item();
        if (MEASURED.matcher(item.name()).matches()) {
            String unit = measuredUnit(item.name());
            String cleanName = cleanMeasuredName(label);
            String displayUnit = "pint".equals(unit) && selection.quantity() != 1 ? "pints" : unit;
            return selection.quantity() + " " + displayUnit + " of " + cleanName
                    + " [á " + price(selection.unitCp()) + "/" + unit + "]";
        }
        return selection.quantity() + "x " + label + " [á " + price(selection.unitCp()) + "]";
    }

    private static BuiltLine builtLine(
            LootLine line,
            Item item,
            ContainerChoice packing,
            double availableCp,
            boolean nonMagic,
            String itemId,
            String coinText
    ) {
        PackingData data = PackingData.item(item, line.quantity()).withChoice(packing);
        return new BuiltLine(line, data, new LineAudit(
                line.lineId(), nonMagic, availableCp, line.actualCp(), packing.valid(), true, itemId), coinText);
    }

    private static List<LootLine> packTreasure(List<BuiltLine> lines) {
        Map<String, Double> cumulativeByType = new LinkedHashMap<>();
        List<LootLine> packed = new ArrayList<>();
        for (BuiltLine built : lines) {
            LootLine line = built.line();
            ContainerChoice choice = built.packing().choice();
            if (choice == null || "none".equals(choice.name())) {
                packed.add(new LootLine(
                        line.lineId(), line.role(), line.item(), line.quantity(), line.unitCp(), line.actualCp(),
                        "none", line.rarity(), line.cursed(), line.text(),
                        line.baseLootItemId(), line.magicSource(), line.curseId()));
                continue;
            }
            double cumulative = cumulativeByType.merge(
                    choice.name(), built.packing().totalCapacity(), Double::sum);
            int end = Math.max(1, (int) Math.ceil(cumulative / Math.max(0.000001d, choice.capacity())));
            String reference = choice.name() + " 1" + (end > 1 ? "-" + end : "");
            String text = packedContent(built, end);
            packed.add(new LootLine(
                    line.lineId(), line.role(), line.item(), line.quantity(), line.unitCp(), line.actualCp(),
                    reference, line.rarity(), line.cursed(), text,
                    line.baseLootItemId(), line.magicSource(), line.curseId()));
        }
        return List.copyOf(packed);
    }

    private static String packedContent(BuiltLine built, int containerCount) {
        if (!built.coinText().isBlank()) return built.coinText();
        if (!built.packing().measured()) return built.line().text();
        String cleanName = cleanMeasuredName(built.line().item());
        double weight = built.packing().totalWeight() / Math.max(1, containerCount);
        double actualGp = built.line().actualCp() / 100d / Math.max(1, containerCount);
        return cleanName + " [á " + amount(weight) + " lb, " + amount(actualGp) + " gp]";
    }

    private static LootDiagnostics diagnostics(
            List<TreasureDraft> drafts,
            List<TreasureResult> results,
            List<LineAudit> lineAudits
    ) {
        List<Integer> slotCounts = drafts.stream().map(TreasureDraft::nonMagicSlots).toList();
        Map<Integer, Double> targets = new LinkedHashMap<>();
        drafts.forEach(draft -> targets.put(draft.treasureId(), draft.targetCp()));
        return new LootDiagnostics(slotCounts, Map.copyOf(targets), List.copyOf(lineAudits),
                results.stream().filter(value -> "normal".equals(value.stockClass()))
                        .mapToLong(TreasureResult::actualCp).sum(),
                results.stream().filter(value -> "overstock".equals(value.stockClass()))
                        .mapToLong(TreasureResult::actualCp).sum());
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
        List<String> normalRarities = rarities(treasures, "normal");
        List<String> overstockRarities = rarities(treasures, "overstock");
        output.append("\nMagic Items: ").append(raritySummary(normalRarities));
        if (!overstockRarities.isEmpty()) {
            output.append(" + ").append(raritySummary(overstockRarities)).append(" Overstock");
        }
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
                appendIndented(output, line.text(), "   ");
                continue;
            }
            if (!emittedContainers.add(line.container())) continue;
            java.util.regex.Matcher matcher = Pattern.compile("^(.+) 1(?:-(\\d+))?$").matcher(line.container());
            if (!matcher.matches()) {
                appendIndented(output, line.text(), "   ");
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
                    .forEach(value -> appendIndented(output, value.text(), "      "));
        }
    }

    private static void appendIndented(StringBuilder output, String text, String indentation) {
        for (String line : text.split("\\R", -1)) output.append(indentation).append(line).append("\n");
    }

    private static String plural(String type) {
        return switch (type) {
            case "Pouch" -> "Pouches";
            case "Chest" -> "Chests";
            default -> type + "s";
        };
    }

    private static List<String> rarities(List<TreasureResult> treasures, String stockClass) {
        return treasures.stream().filter(treasure -> stockClass.equals(treasure.stockClass()))
                .flatMap(treasure -> treasure.loot().stream())
                .map(LootLine::rarity)
                .filter(value -> value != null && !value.isBlank())
                .toList();
    }

    private static String raritySummary(List<String> rarities) {
        return rarities.isEmpty() ? "0" : rarities.size() + " [" + String.join(", ", rarities) + "]";
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
                .map(row -> new Curse(row.get("Curse_ID"), row.get("Name"), row.get("Effect"),
                        Math.max(1, (int) number(row, "Weight")),
                        row.get("Applies_To"), Boolean.parseBoolean(row.getOrDefault("Requires_Attunement", "false")),
                        active(row))).toList();
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

    private static boolean matchesValueOrAll(String value, String target) {
        return "all".equals(value) || java.util.Objects.equals(value, target);
    }

    private static boolean active(Map<String, String> row) {
        return Boolean.parseBoolean(row.getOrDefault("Active", "false"));
    }

    private static double number(Map<String, String> row, String column) {
        String value = row.getOrDefault(column, "");
        return value.isBlank() ? 0d : Double.parseDouble(value);
    }

    private static double unitQuadratic(long base, long cross) {
        return quadraticMod(base, cross) / 1_000_003d;
    }

    private static long quadraticMod(long base, long cross) {
        java.math.BigInteger value = java.math.BigInteger.valueOf(base).multiply(java.math.BigInteger.valueOf(base))
                .add(java.math.BigInteger.valueOf(cross));
        return value.mod(java.math.BigInteger.valueOf(1_000_003L)).longValue();
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

    private static String whole(Map<String, String> row, String column) {
        return Long.toString(Math.round(number(row, column)));
    }

    private static String measuredUnit(String name) {
        java.util.regex.Matcher matcher = Pattern.compile("(?i)\\((lb(?:/sq yd)?|pint|fl oz)\\)$").matcher(name);
        return matcher.find() ? matcher.group(1).toLowerCase(Locale.ROOT) : "";
    }

    private static String cleanMeasuredName(String name) {
        return name.replaceFirst("(?i) \\((?:lb(?:/sq yd)?|pint|fl oz)\\)$", "");
    }

    private static String price(long cp) {
        return cp < 100L ? cp + " cp" : gp(cp) + " gp";
    }

    private static String coinText(CoinProfile profile, long high, long middle, long low) {
        List<String> lines = new ArrayList<>();
        lines.add(coinCount(high, profile.highName()));
        if (profile.lowUnit() > 0L) lines.add(coinCount(middle, profile.middleName()));
        lines.add(coinCount(low, profile.lowUnit() > 0L ? profile.lowName() : profile.middleName()));
        return String.join("\n", lines);
    }

    private static String coinCount(long count, String denomination) {
        return count + " " + denomination + (count == 1L ? " Coin" : " Coins");
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

    record LootOutput(
            List<TreasureResult> treasures,
            RewardSummary summary,
            String formattedText,
            LootDiagnostics diagnostics
    ) {
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

    private record Curse(
            String id,
            String name,
            String effect,
            int weight,
            String appliesTo,
            boolean requiresAttunement,
            boolean active
    ) {
    }

    private record Container(double capacity, boolean hidden) {
    }

    private record Selection(
            Item item,
            String modifier,
            int quantity,
            long unitCp,
            long actualCp,
            double gap,
            double score
    ) {
    }

    private record VariantSelection(
            String name,
            long addCp,
            long actualCp,
            double gap,
            double jitter,
            int databaseRow
    ) {
    }

    private record MagicResolution(
            String text,
            String curseContext,
            String baseItemId,
            String magicSource,
            boolean resolved
    ) {
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

    private record ContainerChoice(
            String name,
            int count,
            double fill,
            boolean hidden,
            double capacity,
            boolean valid
    ) {
        static ContainerChoice none() {
            return new ContainerChoice("none", 0, 0d, false, 0d, true);
        }
    }

    private record PackingData(
            int quantity,
            double totalCapacity,
            double totalWeight,
            List<String> allowedContainers,
            boolean loose,
            boolean liquid,
            boolean measured,
            ContainerChoice choice
    ) {
        static PackingData item(Item item, int quantity) {
            boolean measured = MEASURED.matcher(item.name()).matches();
            boolean loose = quantity <= 1 && ("worn".equals(item.placement())
                    || "handheld".equals(item.placement()) || (!measured && item.capacity() >= 2d));
            return new PackingData(
                    quantity,
                    item.capacity() * quantity,
                    item.baseLb() * quantity,
                    item.allowedContainers(),
                    loose,
                    isLiquid(item.name()),
                    measured,
                    null);
        }

        static PackingData coin(double capacity) {
            return new PackingData(1, capacity, 0d, List.of("Pouch", "Chest"), false, false, false, null);
        }

        static PackingData none() {
            return new PackingData(1, 0d, 0d, List.of(), true, false, false, ContainerChoice.none());
        }

        PackingData withChoice(ContainerChoice value) {
            return new PackingData(
                    quantity, totalCapacity, totalWeight, allowedContainers, loose, liquid, measured, value);
        }
    }

    private record BuiltLine(LootLine line, PackingData packing, LineAudit audit, String coinText) {
    }

    record LineAudit(
            int lineId,
            boolean nonMagic,
            double availableCp,
            long actualCp,
            boolean packingValid,
            boolean resolved,
            String itemId
    ) {
    }

    record LootDiagnostics(
            List<Integer> slotCounts,
            Map<Integer, Double> targetCpByTreasure,
            List<LineAudit> lines,
            long normalActualCp,
            long overstockActualCp
    ) {
    }

    private record CoinProfile(
            String name,
            long highUnit,
            long middleUnit,
            long lowUnit,
            long maximumBudget,
            String highName,
            String middleName,
            String lowName
    ) {
        long minimumValue() {
            return highUnit + (lowUnit > 0L ? middleUnit + 5L * lowUnit : 5L * middleUnit);
        }
    }
}
