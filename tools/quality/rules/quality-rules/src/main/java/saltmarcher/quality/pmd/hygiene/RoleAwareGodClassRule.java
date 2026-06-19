package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.rule.design.GodClassRule;

public final class RoleAwareGodClassRule extends GodClassRule {

    @Override
    public Object visit(ASTClassDeclaration node, Object data) {
        if (RoleAwareMetricSupport.isTopLevelViewRoleShapeMetricSource(node)
                || RoleAwareMetricSupport.isTopLevelFeatureRuntimeArchitectureMetricSource(node)) {
            return null;
        }
        return super.visit(node, data);
    }
}
