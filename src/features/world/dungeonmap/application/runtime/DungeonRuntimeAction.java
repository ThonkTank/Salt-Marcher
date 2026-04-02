package features.world.dungeonmap.application.runtime;

/**
 * Runtime interaction entries share one surface API even when their concrete movement semantics differ.
 */
public sealed interface DungeonRuntimeAction
        permits DungeonRuntimeDoorDescriptor, DungeonRuntimeStairDescriptor, DungeonRuntimeTransitionDescriptor {

    String displayLabel();

    String description();
}
