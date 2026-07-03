package src.domain.worldplanner.model.world.usecase;

import java.util.ArrayList;
import java.util.List;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldLocation;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldPlannerState;

final class WorldPlannerStateChanges {

    static WorldPlannerState replaceNpc(
            WorldPlannerState state,
            WorldNpc replacement,
            String statusText
    ) {
        return new WorldPlannerState(
                replaceNpc(state.npcs(), replacement),
                state.factions(),
                state.locations(),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId(),
                statusText);
    }

    static WorldPlannerState replaceFaction(
            WorldPlannerState state,
            WorldFaction replacement,
            String statusText
    ) {
        return new WorldPlannerState(
                state.npcs(),
                replaceFaction(state.factions(), replacement),
                state.locations(),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId(),
                statusText);
    }

    static WorldPlannerState replaceLocation(
            WorldPlannerState state,
            WorldLocation replacement,
            String statusText
    ) {
        return new WorldPlannerState(
                state.npcs(),
                state.factions(),
                replaceLocation(state.locations(), replacement),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId(),
                statusText);
    }

    static <T> List<T> append(List<T> values, T value) {
        List<T> nextValues = new ArrayList<>(values);
        nextValues.add(value);
        return nextValues;
    }

    private static List<WorldNpc> replaceNpc(List<WorldNpc> values, WorldNpc replacement) {
        List<WorldNpc> nextValues = new ArrayList<>(values);
        for (int index = 0; index < nextValues.size(); index++) {
            if (nextValues.get(index).npcId() == replacement.npcId()) {
                nextValues.set(index, replacement);
            }
        }
        return List.copyOf(nextValues);
    }

    private static List<WorldFaction> replaceFaction(List<WorldFaction> values, WorldFaction replacement) {
        List<WorldFaction> nextValues = new ArrayList<>(values);
        for (int index = 0; index < nextValues.size(); index++) {
            if (nextValues.get(index).factionId() == replacement.factionId()) {
                nextValues.set(index, replacement);
            }
        }
        return List.copyOf(nextValues);
    }

    private static List<WorldLocation> replaceLocation(List<WorldLocation> values, WorldLocation replacement) {
        List<WorldLocation> nextValues = new ArrayList<>(values);
        for (int index = 0; index < nextValues.size(); index++) {
            if (nextValues.get(index).locationId() == replacement.locationId()) {
                nextValues.set(index, replacement);
            }
        }
        return List.copyOf(nextValues);
    }

    private WorldPlannerStateChanges() {
    }
}
