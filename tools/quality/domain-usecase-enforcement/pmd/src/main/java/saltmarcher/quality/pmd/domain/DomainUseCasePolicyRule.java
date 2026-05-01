package saltmarcher.quality.pmd.domain;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DomainUseCasePolicyRule extends AbstractJavaRule {

    private static final Pattern DOMAIN_APPLICATION_POLICY_HELPER_PATTERN = Pattern.compile(
            "(?m)^\\s*(?!(?:public\\b))(?:(?:private|protected)\\s+)?(?:static\\s+)?(?:<[^>]+>\\s+)?[A-Za-z0-9_<>, ?.@\\[\\]]+\\s+"
                    + "((?:score|rank|choose|balance|enforce)[A-Za-z0-9_]*)\\s*\\(");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots() || !sourceFacts.isDomainApplicationSource()) {
            return data;
        }

        Matcher matcher = DOMAIN_APPLICATION_POLICY_HELPER_PATTERN.matcher(sourceFacts.text());
        if (matcher.find()) {
            asCtx(data).addViolationWithMessage(node,
                    "Domain application code must not hide policy helper method '" + matcher.group(1)
                            + "'. Move rule-bearing behavior into the owning domain module and keep application code as orchestration.");
        }
        return data;
    }
}
