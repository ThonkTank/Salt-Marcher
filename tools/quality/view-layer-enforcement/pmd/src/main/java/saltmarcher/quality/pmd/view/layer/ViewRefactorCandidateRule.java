package saltmarcher.quality.pmd.view.layer;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class ViewRefactorCandidateRule extends AbstractJavaRule {

    private static final String MAP_CANVAS_VIEW_PATH =
            "src/view/slotcontent/primitives/mapcanvas/MapCanvasView.java";

    private static final Set<String> PHASE_SEAMS = Set.of(
            "onPrimaryPressed(",
            "onPrimaryDragged(",
            "onPrimaryReleased(",
            "onPointerMoved(");

    private static final Set<String> HIT_STAGES = Set.of(
            "actorHit(",
            "glyphHit(",
            "textHit(",
            "boundaryHit(",
            "relationHit(");

    private static final Set<String> DRAW_STAGES = Set.of(
            "drawSurface(",
            "drawBoundaries(",
            "drawRelations(",
            "drawGlyphs(",
            "drawTexts(",
            "drawOverlays(");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!MAP_CANVAS_VIEW_PATH.equals(sourceFacts.relativePath())) {
            return data;
        }

        List<String> findings = new ArrayList<>();
        String sourceText = sourceFacts.text();
        if (countMatches(sourceText, PHASE_SEAMS) >= 3) {
            findings.add("phase-specific outward pointer seams");
        }
        if (countMatches(sourceText, HIT_STAGES) >= 4) {
            findings.add("view-local hit-priority reconstruction");
        }
        if (countMatches(sourceText, DRAW_STAGES) >= 4) {
            findings.add("view-local scene draw staging");
        }
        if (findings.isEmpty()) {
            return data;
        }

        asCtx(data).addViolationWithMessage(
                node,
                "Shared view primitive refactor candidate '" + sourceFacts.relativePath() + "': "
                        + String.join(", ", findings)
                        + ". Prefer one technical canvas event seam, keep the View limited to viewport/render/raw-hit execution,"
                        + " and move primitive ordering, hit priority, prepared geometry, and scene assembly into MapRenderScene"
                        + " plus the owning ContentModel or upstream read-side projection.");
        return data;
    }

    private static int countMatches(String sourceText, Set<String> probes) {
        int matches = 0;
        for (String probe : probes) {
            if (sourceText.contains(probe)) {
                matches++;
            }
        }
        return matches;
    }
}
