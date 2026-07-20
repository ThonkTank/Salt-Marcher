package features.dungeon.application.editor;

record PointerWorkflowIntent(
        boolean workflowAccepted,
        DungeonEditorToolAction toolAction,
        boolean boundaryTargetsPreferred,
        boolean wallSingleClickMode
) {
    PointerWorkflowIntent {
        toolAction = toolAction == null
                ? DungeonEditorToolAction.selected(null)
                : toolAction;
    }

    static PointerWorkflowIntent ignored() {
        return new PointerWorkflowIntent(false, DungeonEditorToolAction.selected(null), false, false);
    }

}

record PointerInteractionCandidates(
        features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget
) {
    PointerInteractionCandidates {
        primaryTarget = primaryTarget == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : primaryTarget;
    }

    static PointerInteractionCandidates empty() {
        return new PointerInteractionCandidates(features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty());
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
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target
) {
    PointerSample {
        target = target == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : target;
    }
}

enum PointerTargetChoice {
    EMPTY {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            return features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty();
        }
    },
    PRIMARY {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            return primaryTarget == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : primaryTarget;
        }
    },
    ROOM_CELL_HOVER {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            return features.dungeon.api.editor.DungeonEditorPointerInput.Target.syntheticCell(
                    features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.ROOM,
                    (int) targets.sceneX(),
                    (int) targets.sceneY(),
                    projectionLevel);
        }
    },
    WALL_VERTEX_HOVER {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            return features.dungeon.api.editor.DungeonEditorPointerInput.Target.vertex(
                    Math.toIntExact(Math.round(targets.sceneX())),
                    Math.toIntExact(Math.round(targets.sceneY())),
                    projectionLevel);
        }
    },
    WALL_BOUNDARY_HOVER {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            return targets.wallBoundaryHoverTarget();
        }
    },
    TRANSITION_PLACEMENT {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            features.dungeon.api.editor.DungeonEditorPointerInput.Target safePrimary =
                    primaryTarget == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : primaryTarget;
            if (safePrimary.isBoundaryTarget() || safePrimary.isCellTarget()) {
                return safePrimary;
            }
            return features.dungeon.api.editor.DungeonEditorPointerInput.Target.syntheticCell(
                    features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.TRANSITION,
                    (int) Math.floor(targets.sceneX()),
                    (int) Math.floor(targets.sceneY()),
                    projectionLevel);
        }
    },
    HOVER_TARGET {
        @Override
        features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
                PointerInteractionTargets targets,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
                int projectionLevel
        ) {
            return hoverTarget == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : hoverTarget;
        }
    };

    abstract features.dungeon.api.editor.DungeonEditorPointerInput.Target target(
            PointerInteractionTargets targets,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target hoverTarget,
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
