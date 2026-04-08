package features.world.dungeon.runtime.input;

import java.util.Objects;

public record NavigateInput(
        long mapId,
        NavigationInput currentNavigation,
        ActionInput action
) {
    public record NavigationInput(
            Long mapId,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ,
            String heading
    ) {
        public NavigationInput {
            heading = heading == null ? "" : heading.trim();
        }

        public static NavigationInput empty() {
            return new NavigationInput(null, null, 0, "");
        }

        public static NavigationInput navigation(
                Long mapId,
                features.world.dungeon.geometry.GridPoint cell,
                int levelZ,
                String heading
        ) {
            return new NavigationInput(mapId, cell, levelZ, heading);
        }

        public boolean isEmpty() {
            return mapId == null || cell == null;
        }
    }

    public record ActionInput(
            String kind,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ,
            String headingOverride,
            Long doorId,
            Long transitionId
    ) {
        public ActionInput {
            kind = kind == null ? "" : kind.trim();
            headingOverride = headingOverride == null ? "" : headingOverride.trim();
        }

        public static ActionInput cellAction(
                features.world.dungeon.geometry.GridPoint cell,
                int levelZ,
                String headingOverride
        ) {
            return new ActionInput("CELL", cell, levelZ, headingOverride, null, null);
        }

        public static ActionInput doorAction(Long doorId) {
            return new ActionInput("DOOR", null, 0, "", doorId, null);
        }

        public static ActionInput transitionAction(Long transitionId) {
            return new ActionInput("TRANSITION", null, 0, "", null, transitionId);
        }

        public boolean isCellAction() {
            return "CELL".equalsIgnoreCase(kind);
        }

        public boolean isDoorAction() {
            return "DOOR".equalsIgnoreCase(kind);
        }

        public boolean isTransitionAction() {
            return "TRANSITION".equalsIgnoreCase(kind);
        }

        public boolean hasCellTarget() {
            return cell != null;
        }

        public boolean hasDoorTarget() {
            return doorId != null && doorId > 0;
        }

        public boolean hasTransitionTarget() {
            return transitionId != null && transitionId > 0;
        }

        public features.world.dungeon.geometry.GridPoint requireCellTarget() {
            return Objects.requireNonNull(hasCellTarget() ? cell : null, "action.cell");
        }

        public Long requireDoorTarget() {
            return Objects.requireNonNull(hasDoorTarget() ? doorId : null, "action.doorId");
        }

        public Long requireTransitionTarget() {
            return Objects.requireNonNull(hasTransitionTarget() ? transitionId : null, "action.transitionId");
        }

        public String resolvedHeadingOverride() {
            return headingOverride;
        }

        public String label() {
            if (isCellAction()) {
                return "Bewegen";
            }
            if (isDoorAction()) {
                return "Tür benutzen";
            }
            if (isTransitionAction()) {
                return "Übergang benutzen";
            }
            return "Aktion";
        }

        public String failureMessage() {
            if (isCellAction()) {
                return "Bewegung konnte nicht ausgeführt werden";
            }
            if (isDoorAction()) {
                return "Verbindung konnte nicht benutzt werden";
            }
            if (isTransitionAction()) {
                return "Übergang konnte nicht benutzt werden";
            }
            return "Aktion konnte nicht ausgeführt werden";
        }
    }
}
