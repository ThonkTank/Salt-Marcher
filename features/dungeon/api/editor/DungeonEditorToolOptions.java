package features.dungeon.api.editor;

/** Typed family-specific Dungeon Editor tool parameters. */
public sealed interface DungeonEditorToolOptions
        permits DungeonEditorToolOptions.None,
                DungeonEditorToolOptions.Wall,
                DungeonEditorToolOptions.Stair,
                DungeonEditorToolOptions.Feature {

    record None() implements DungeonEditorToolOptions {
    }

    record Wall(Mode mode) implements DungeonEditorToolOptions {
        public Wall {
            mode = mode == null ? Mode.PATH : mode;
        }

        public enum Mode {
            PATH,
            SINGLE
        }
    }

    record Stair(Shape shape) implements DungeonEditorToolOptions {
        public Stair {
            shape = shape == null ? Shape.STRAIGHT : shape;
        }

        public enum Shape {
            STRAIGHT,
            SQUARE,
            CIRCULAR
        }
    }

    record Feature(Kind kind) implements DungeonEditorToolOptions {
        public Feature {
            kind = kind == null ? Kind.POINT_OF_INTEREST : kind;
        }

        public enum Kind {
            POINT_OF_INTEREST,
            OBJECT,
            ENCOUNTER
        }
    }

    static None none() {
        return new None();
    }
}
