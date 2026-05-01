package saltmarcher.quality.pmd.shell.runtimecontext;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class ShellRuntimeContextGatewayShapeRule extends AbstractJavaRule {

    private static final Pattern PUBLIC_METHOD_PATTERN = Pattern.compile(
            "(?m)^\\s*public\\s+(?:synchronized\\s+)?(?:<[^>]+>\\s+)?[A-Za-z0-9_<>, ?.@]+\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    private static final Set<String> CONTROL_FLOW_METHOD_NAMES = Set.of("if", "for", "while", "switch");
    private static final List<String> SHELL_RUNTIME_CONTEXT_ALLOWED_METHODS = List.of(
            "inspector",
            "services",
            "session");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots()
                || !sourceFacts.relativePath().equals("shell/api/ShellRuntimeContext.java")) {
            return data;
        }

        List<String> methods = publicMethods(sourceFacts.text());
        if (!methods.equals(SHELL_RUNTIME_CONTEXT_ALLOWED_METHODS)) {
            asCtx(data).addViolationWithMessage(node,
                    "ShellRuntimeContext must expose only the fixed runtime gateway methods: "
                            + String.join(", ", SHELL_RUNTIME_CONTEXT_ALLOWED_METHODS) + ".");
        }
        return data;
    }

    private static List<String> publicMethods(String sourceText) {
        Matcher matcher = PUBLIC_METHOD_PATTERN.matcher(sourceText);
        List<String> methods = new ArrayList<>();
        while (matcher.find()) {
            String methodName = matcher.group(1);
            if (!CONTROL_FLOW_METHOD_NAMES.contains(methodName)) {
                methods.add(methodName);
            }
        }
        return methods;
    }
}
