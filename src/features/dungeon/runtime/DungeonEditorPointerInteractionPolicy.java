package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorTool;

record PointerWorkflowIntent(
        boolean workflowAccepted,
        DungeonEditorTool effectiveTool,
        boolean boundaryTargetsPreferred,
        boolean wallSingleClickMode
) {
    PointerWorkflowIntent {
        effectiveTool = effectiveTool == null ? DungeonEditorTool.SELECT : effectiveTool;
    }

    static PointerWorkflowIntent ignored() {
        return new PointerWorkflowIntent(false, DungeonEditorTool.SELECT, false, false);
    }

}

record PointerInteractionCandidates(
        DungeonEditorRuntimePointerTarget primaryTarget
) {
    PointerInteractionCandidates {
        primaryTarget = primaryTarget == null ? DungeonEditorRuntimePointerTarget.empty() : primaryTarget;
    }

    static PointerInteractionCandidates empty() {
        return new PointerInteractionCandidates(DungeonEditorRuntimePointerTarget.empty());
    }
}

record PointerInteractionDecision(
        PointerTargetChoice hoverTargetChoice,
        PointerTargetChoice sampleTargetChoice
) {
    PointerInteractionDecision {
        hoverTargetChoice = PointerTargetChoice.safe(hoverTargetChoice);
        sampleTargetChoice = sampleTargetChoice == null ? PointerTargetChoice.primary() : sampleTargetChoice;
    }

    static PointerInteractionDecision ignored() {
        return new PointerInteractionDecision(PointerTargetChoice.empty(), PointerTargetChoice.primary());
    }
}

record PointerSample(
        double sceneX,
        double sceneY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        DungeonEditorRuntimePointerTarget target
) {
    PointerSample {
        target = target == null ? DungeonEditorRuntimePointerTarget.empty() : target;
    }
}

enum PointerTargetChoice {
    EMPTY {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            return DungeonEditorRuntimePointerTarget.empty();
        }
    },
    PRIMARY {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            return primaryTarget == null ? DungeonEditorRuntimePointerTarget.empty() : primaryTarget;
        }
    },
    ROOM_CELL_HOVER {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            return DungeonEditorRuntimePointerTarget.syntheticCell(
                    DungeonEditorRuntimePointerTarget.ElementKind.ROOM,
                    (int) targets.sceneX(),
                    (int) targets.sceneY(),
                    projectionLevel);
        }
    },
    WALL_VERTEX_HOVER {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            return DungeonEditorRuntimePointerTarget.vertex(
                    Math.toIntExact(Math.round(targets.sceneX())),
                    Math.toIntExact(Math.round(targets.sceneY())),
                    projectionLevel);
        }
    },
    WALL_BOUNDARY_HOVER {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            return targets.wallBoundaryHoverTarget();
        }
    },
    TRANSITION_PLACEMENT {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            DungeonEditorRuntimePointerTarget safePrimary =
                    primaryTarget == null ? DungeonEditorRuntimePointerTarget.empty() : primaryTarget;
            if (safePrimary.isBoundaryTarget() || safePrimary.isCellTarget()) {
                return safePrimary;
            }
            return DungeonEditorRuntimePointerTarget.syntheticCell(
                    DungeonEditorRuntimePointerTarget.ElementKind.TRANSITION,
                    (int) Math.floor(targets.sceneX()),
                    (int) Math.floor(targets.sceneY()),
                    projectionLevel);
        }
    },
    HOVER_TARGET {
        @Override
        DungeonEditorRuntimePointerTarget target(
                PointerInteractionTargets targets,
                DungeonEditorRuntimePointerTarget primaryTarget,
                DungeonEditorRuntimePointerTarget hoverTarget,
                int projectionLevel
        ) {
            return hoverTarget == null ? DungeonEditorRuntimePointerTarget.empty() : hoverTarget;
        }
    };

    abstract DungeonEditorRuntimePointerTarget target(
            PointerInteractionTargets targets,
            DungeonEditorRuntimePointerTarget primaryTarget,
            DungeonEditorRuntimePointerTarget hoverTarget,
            int projectionLevel);

    static PointerTargetChoice empty() {
        return EMPTY;
    }

    static PointerTargetChoice primary() {
        return PRIMARY;
    }

    static PointerTargetChoice roomCellHover() {
        return ROOM_CELL_HOVER;
    }

    static PointerTargetChoice wallVertexHover() {
        return WALL_VERTEX_HOVER;
    }

    static PointerTargetChoice wallBoundaryHover() {
        return WALL_BOUNDARY_HOVER;
    }

    static PointerTargetChoice transitionPlacement() {
        return TRANSITION_PLACEMENT;
    }

    static PointerTargetChoice hoverTarget() {
        return HOVER_TARGET;
    }

    static PointerTargetChoice safe(PointerTargetChoice choice) {
        return choice == null ? EMPTY : choice;
    }
}
