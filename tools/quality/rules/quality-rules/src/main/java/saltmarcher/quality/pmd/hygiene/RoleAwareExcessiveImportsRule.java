package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.design.ExcessiveImportsRule;

public final class RoleAwareExcessiveImportsRule extends ExcessiveImportsRule {

    @Override
    protected boolean isIgnored(ASTCompilationUnit node) {
        return RoleAwareMetricSupport.isViewRoleShapeMetricSource(node) || super.isIgnored(node);
    }
}
