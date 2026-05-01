package saltmarcher.quality.pmd.data.servicecontribution;

import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataServiceContributionSourceMechanicsRule extends AbstractJavaRule {

    private static final Set<String> CONCRETE_SOURCE_TOKENS = Set.of(
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.nio.file.",
            "java.io.");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isDataRoot()) {
            return data;
        }

        String sourceText = codeTextWithoutCommentsAndStrings(sourceFacts.text());
        for (String token : CONCRETE_SOURCE_TOKENS) {
            if (sourceText.contains(token)) {
                asCtx(data).addViolationWithMessage(node,
                        "Data ServiceContribution root must not own concrete source mechanics such as '"
                                + token + "'. Move source-specific work behind same-feature adapters.");
            }
        }
        return data;
    }

    private static String codeTextWithoutCommentsAndStrings(String text) {
        StringBuilder result = new StringBuilder(text.length());
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                    result.append(current);
                } else {
                    result.append(' ');
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    result.append("  ");
                    index++;
                } else {
                    result.append(current == '\n' || current == '\r' ? current : ' ');
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                result.append(' ');
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                result.append(' ');
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                result.append(' ');
                continue;
            }
            if (current == '\'') {
                inChar = true;
                result.append(' ');
                continue;
            }
            result.append(current);
        }
        return result.toString();
    }
}
