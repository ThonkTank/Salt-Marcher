package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.design.ExcessiveImportsRule;

public final class SourceShapeExcessiveImportsRule extends ExcessiveImportsRule {

    @Override
    protected boolean isIgnored(ASTCompilationUnit node) {
        return SourceShapeMetricSupport.isViewShapeMetricSource(node)
                || SourceShapeMetricSupport.isFeatureRuntimeArchitectureMetricSource(node)
                || super.isIgnored(node);
    }
}
