package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.rule.design.GodClassRule;

public final class SourceShapeGodClassRule extends GodClassRule {

    @Override
    public Object visit(ASTClassDeclaration node, Object data) {
        if (SourceShapeMetricSupport.isTopLevelViewShapeMetricSource(node)
                || SourceShapeMetricSupport.isTopLevelFeatureRuntimeArchitectureMetricSource(node)) {
            return null;
        }
        return super.visit(node, data);
    }
}
