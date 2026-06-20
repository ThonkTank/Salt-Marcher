package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.rule.design.CyclomaticComplexityRule;

public final class RoleAwareCyclomaticComplexityRule extends CyclomaticComplexityRule {

    @Override
    public Object visitTypeDecl(ASTTypeDeclaration node, Object data) {
        if (RoleAwareMetricSupport.isTopLevelViewRoleShapeMetricSource(node)
                || RoleAwareMetricSupport.isTopLevelFeatureRuntimeArchitectureMetricSource(node)) {
            return null;
        }
        return super.visitTypeDecl(node, data);
    }
}
