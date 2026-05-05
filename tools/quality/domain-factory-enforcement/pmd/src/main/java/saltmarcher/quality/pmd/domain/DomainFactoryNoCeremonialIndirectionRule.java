package saltmarcher.quality.pmd.domain;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DomainFactoryNoCeremonialIndirectionRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!DomainCeremonialIndirectionSupport.isFactorySource(sourceFacts)) {
            return data;
        }

        DomainCeremonialIndirectionSupport.Analysis analysis =
                DomainCeremonialIndirectionSupport.analyze(sourceFacts);
        if (!analysis.ceremonial()) {
            return data;
        }

        asCtx(data).addViolationWithMessage(node,
                "Domain factory role '" + sourceFacts.relativePath()
                        + "' is ceremonial indirection only: all non-constructor methods merely "
                        + String.join(", ", analysis.trivialDescriptions())
                        + ". Factory roles must own meaningful construction logic instead of only relaying to "
                        + analysis.collaboratorTarget() + ".");
        return data;
    }
}
