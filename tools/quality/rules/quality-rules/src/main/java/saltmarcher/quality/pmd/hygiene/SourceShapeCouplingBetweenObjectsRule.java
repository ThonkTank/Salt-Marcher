package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.design.CouplingBetweenObjectsRule;

public final class SourceShapeCouplingBetweenObjectsRule extends CouplingBetweenObjectsRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        if (SourceShapeMetricSupport.isViewShapeMetricSource(node)
                || SourceShapeMetricSupport.isFeatureRuntimeArchitectureMetricSource(node)) {
            return null;
        }
        return super.visit(node, data);
    }
}
