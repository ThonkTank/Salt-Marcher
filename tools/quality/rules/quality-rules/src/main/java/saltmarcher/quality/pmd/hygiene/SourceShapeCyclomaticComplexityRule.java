package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.rule.design.CyclomaticComplexityRule;

public final class SourceShapeCyclomaticComplexityRule extends CyclomaticComplexityRule {

    @Override
    public Object visitTypeDecl(ASTTypeDeclaration node, Object data) {
        if (SourceShapeMetricSupport.isTopLevelViewShapeMetricSource(node)
                || SourceShapeMetricSupport.isTopLevelFeatureRuntimeArchitectureMetricSource(node)) {
            return null;
        }
        return super.visitTypeDecl(node, data);
    }
}
