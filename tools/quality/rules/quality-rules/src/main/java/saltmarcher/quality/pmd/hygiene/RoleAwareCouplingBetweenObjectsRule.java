package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.design.CouplingBetweenObjectsRule;

public final class RoleAwareCouplingBetweenObjectsRule extends CouplingBetweenObjectsRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        if (RoleAwareMetricSupport.isViewRoleShapeMetricSource(node)
                || RoleAwareMetricSupport.isFeatureRuntimeArchitectureMetricSource(node)) {
            return null;
        }
        return super.visit(node, data);
    }
}
