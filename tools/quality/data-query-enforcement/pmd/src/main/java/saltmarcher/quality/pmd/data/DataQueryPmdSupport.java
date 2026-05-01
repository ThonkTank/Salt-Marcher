package saltmarcher.quality.pmd.data;

import java.util.Set;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class DataQueryPmdSupport {

    static final Set<String> CONCRETE_SOURCE_TOKENS = Set.of(
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.nio.file.",
            "java.io.");
    static final Set<String> QUERY_MUTATION_METHOD_PREFIXES = Set.of(
            "add",
            "create",
            "delete",
            "insert",
            "mutate",
            "persist",
            "remove",
            "save",
            "set",
            "store",
            "update",
            "upsert",
            "write");

    private DataQueryPmdSupport() {
    }

    static boolean isQuery(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/query/");
    }

    static boolean isMutationMethodName(String methodName) {
        String normalized = methodName.toLowerCase();
        return QUERY_MUTATION_METHOD_PREFIXES.stream().anyMatch(normalized::startsWith);
    }

    static String codeTextWithoutCommentsAndStrings(String text) {
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
