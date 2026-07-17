package platform.ui.mapcanvas;

/** Stable paint layers; interaction changes do not invalidate authored content. */
public enum MapCanvasLayer {
    BASE,
    INTERACTION,
    ACTOR
}
