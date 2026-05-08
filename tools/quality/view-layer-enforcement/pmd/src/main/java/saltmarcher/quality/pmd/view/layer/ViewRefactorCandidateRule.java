package saltmarcher.quality.pmd.view.layer;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class ViewRefactorCandidateRule extends AbstractJavaRule {

    private static final Set<String> PHASE_SEAMS = Set.of(
            "onPrimaryPressed(",
            "onPrimaryDragged(",
            "onPrimaryReleased(",
            "onPointerMoved(");
    private static final Pattern PRIMITIVE_VIEW_PATH = Pattern.compile(
            "^src/view/slotcontent/primitives/[^/]+/[^/]+View\\.java$");
    private static final Pattern HIT_STAGE_PATTERN = Pattern.compile("\\b(?:hit[A-Z]\\w*|[A-Za-z]+Hit)\\s*\\(");
    private static final Pattern DRAW_STAGE_PATTERN = Pattern.compile("\\bdraw[A-Z]\\w*\\s*\\(");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!PRIMITIVE_VIEW_PATH.matcher(sourceFacts.relativePath()).matches()) {
            return data;
        }

        List<String> findings = new ArrayList<>();
        String sourceText = sourceFacts.text();
        if (countMatches(sourceText, PHASE_SEAMS) >= 3) {
            findings.add("phase-specific outward pointer seams");
        }
        if (countPatternMatches(sourceText, HIT_STAGE_PATTERN) >= 4) {
            findings.add("view-local hit-priority reconstruction");
        }
        if (countPatternMatches(sourceText, DRAW_STAGE_PATTERN) >= 4) {
            findings.add("view-local scene draw staging");
        }
        if (findings.isEmpty()) {
            return data;
        }

        asCtx(data).addViolationWithMessage(
                node,
                "Shared view primitive refactor candidate '" + sourceFacts.relativePath() + "': "
                        + String.join(", ", findings)
                        + ". Prefer one technical primitive seam, keep the View limited to raw technical rendering/input execution,"
                        + " and move primitive ordering, hit priority, prepared geometry, and scene assembly into same-unit technical carriers"
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

    private static int countPatternMatches(String sourceText, Pattern pattern) {
        int matches = 0;
        var matcher = pattern.matcher(sourceText);
        while (matcher.find()) {
            matches++;
        }
        return matches;
    }
}
