package platform.ui.mapcanvas;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import javafx.scene.canvas.Canvas;
import org.junit.jupiter.api.Test;

final class MapCanvasPaneTest {

    @Test
    void ownsThreeDistinctSizeBoundCanvasesInStableLayerOrder() {
        MapCanvasPane pane = new MapCanvasPane();
        Canvas base = pane.canvas(MapCanvasLayer.BASE);
        Canvas interaction = pane.canvas(MapCanvasLayer.INTERACTION);
        Canvas actor = pane.canvas(MapCanvasLayer.ACTOR);

        assertEquals(3, pane.canvasCount());
        assertEquals(3, pane.getChildren().size());
        assertSame(base, pane.getChildren().get(0));
        assertSame(interaction, pane.getChildren().get(1));
        assertSame(actor, pane.getChildren().get(2));
        assertNotSame(base, interaction);
        assertNotSame(base, actor);
        assertNotSame(interaction, actor);

        assertFalse(base.isMouseTransparent());
        assertTrue(base.isFocusTraversable());
        assertTrue(interaction.isMouseTransparent());
        assertFalse(interaction.isFocusTraversable());
        assertTrue(actor.isMouseTransparent());
        assertFalse(actor.isFocusTraversable());

        assertTrue(base.widthProperty().isBound());
        assertTrue(base.heightProperty().isBound());
        assertTrue(interaction.widthProperty().isBound());
        assertTrue(interaction.heightProperty().isBound());
        assertTrue(actor.widthProperty().isBound());
        assertTrue(actor.heightProperty().isBound());
    }
}
