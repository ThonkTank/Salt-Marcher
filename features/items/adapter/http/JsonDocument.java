package features.items.adapter.http;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/** Small JSON reader kept local to the public reference adapter. */
final class JsonDocument {

    private JsonDocument() {
    }

    static JsonObject parseObject(String source) {
        Object parsed = new Parser(source).parseDocument();
        if (!(parsed instanceof Map<?, ?> values)) {
            throw new IllegalStateException("public item response is not a JSON object");
        }
        return new JsonObject(stringKeyed(values));
    }

    record JsonObject(Map<String, Object> values) {
        JsonObject {
            values = Collections.unmodifiableMap(new LinkedHashMap<>(values));
        }

        String requiredString(String field) {
            String value = optionalString(field);
            if (value.isBlank()) {
                throw new IllegalStateException("public item field is missing: " + field);
            }
            return value;
        }

        String optionalString(String field) {
            Object value = values.get(field);
            if (value == null) {
                return "";
            }
            return value instanceof String text ? text : String.valueOf(value);
        }

        @Nullable Double optionalDouble(String field) {
            Object value = values.get(field);
            return value instanceof Number number ? number.doubleValue() : null;
        }

        @Nullable Integer optionalInteger(String field) {
            Object value = values.get(field);
            return value instanceof Number number ? number.intValue() : null;
        }

        @Nullable JsonObject object(String field) {
            Object value = values.get(field);
            return value instanceof Map<?, ?> object ? new JsonObject(stringKeyed(object)) : null;
        }

        List<Object> array(String field) {
            Object value = values.get(field);
            return value instanceof List<?> list
                    ? Collections.unmodifiableList(new ArrayList<>(list))
                    : List.of();
        }
    }

    private static Map<String, Object> stringKeyed(Map<?, ?> values) {
        Map<String, Object> result = new LinkedHashMap<>();
        values.forEach((key, value) -> {
            if (!(key instanceof String text)) {
                throw new IllegalStateException("JSON object key is not text");
            }
            result.put(text, value);
        });
        return result;
    }

    private static final class Parser {

        private final String source;
        private int offset;

        private Parser(String source) {
            this.source = source == null ? "" : source;
        }

        private Object parseDocument() {
            Object value = parseValue();
            skipWhitespace();
            if (offset != source.length()) {
                throw syntax("unexpected trailing content");
            }
            return value;
        }

        private @Nullable Object parseValue() {
            skipWhitespace();
            if (offset >= source.length()) {
                throw syntax("unexpected end of input");
            }
            return switch (source.charAt(offset)) {
                case '{' -> parseObject();
                case '[' -> parseArray();
                case '"' -> parseString();
                case 't' -> parseLiteral("true", Boolean.TRUE);
                case 'f' -> parseLiteral("false", Boolean.FALSE);
                case 'n' -> parseLiteral("null", null);
                default -> parseNumber();
            };
        }

        private Map<String, Object> parseObject() {
            expect('{');
            Map<String, Object> values = new LinkedHashMap<>();
            skipWhitespace();
            if (consume('}')) {
                return values;
            }
            while (true) {
                skipWhitespace();
                if (offset >= source.length() || source.charAt(offset) != '"') {
                    throw syntax("object key must be a string");
                }
                String key = parseString();
                skipWhitespace();
                expect(':');
                values.put(key, parseValue());
                skipWhitespace();
                if (consume('}')) {
                    return values;
                }
                expect(',');
            }
        }

        private List<Object> parseArray() {
            expect('[');
            List<Object> values = new ArrayList<>();
            skipWhitespace();
            if (consume(']')) {
                return values;
            }
            while (true) {
                values.add(parseValue());
                skipWhitespace();
                if (consume(']')) {
                    return values;
                }
                expect(',');
            }
        }

        private String parseString() {
            expect('"');
            StringBuilder result = new StringBuilder();
            while (offset < source.length()) {
                char current = source.charAt(offset++);
                if (current == '"') {
                    return result.toString();
                }
                if (current != '\\') {
                    if (current < 0x20) {
                        throw syntax("unescaped control character");
                    }
                    result.append(current);
                    continue;
                }
                if (offset >= source.length()) {
                    throw syntax("incomplete escape");
                }
                char escaped = source.charAt(offset++);
                result.append(switch (escaped) {
                    case '"', '\\', '/' -> escaped;
                    case 'b' -> '\b';
                    case 'f' -> '\f';
                    case 'n' -> '\n';
                    case 'r' -> '\r';
                    case 't' -> '\t';
                    case 'u' -> parseUnicode();
                    default -> throw syntax("unsupported escape");
                });
            }
            throw syntax("unterminated string");
        }

        private char parseUnicode() {
            if (offset + 4 > source.length()) {
                throw syntax("incomplete unicode escape");
            }
            String digits = source.substring(offset, offset + 4);
            offset += 4;
            try {
                return (char) Integer.parseInt(digits, 16);
            } catch (NumberFormatException exception) {
                throw syntax("invalid unicode escape");
            }
        }

        private Object parseNumber() {
            int start = offset;
            if (consume('-')) {
                // sign consumed
            }
            digits();
            boolean decimal = false;
            if (consume('.')) {
                decimal = true;
                digits();
            }
            if (consume('e') || consume('E')) {
                decimal = true;
                if (!consume('+')) {
                    consume('-');
                }
                digits();
            }
            if (start == offset) {
                throw syntax("value is not valid JSON");
            }
            String token = source.substring(start, offset);
            try {
                if (decimal) {
                    return Double.parseDouble(token);
                }
                return Long.parseLong(token);
            } catch (NumberFormatException exception) {
                throw syntax("invalid number");
            }
        }

        private void digits() {
            int start = offset;
            while (offset < source.length() && Character.isDigit(source.charAt(offset))) {
                offset++;
            }
            if (start == offset) {
                throw syntax("number requires digits");
            }
        }

        private @Nullable Object parseLiteral(String token, @Nullable Object value) {
            if (!source.startsWith(token, offset)) {
                throw syntax("invalid literal");
            }
            offset += token.length();
            return value;
        }

        private boolean consume(char expected) {
            if (offset < source.length() && source.charAt(offset) == expected) {
                offset++;
                return true;
            }
            return false;
        }

        private void expect(char expected) {
            if (!consume(expected)) {
                throw syntax("expected '" + expected + "'");
            }
        }

        private void skipWhitespace() {
            while (offset < source.length() && Character.isWhitespace(source.charAt(offset))) {
                offset++;
            }
        }

        private IllegalStateException syntax(String message) {
            return new IllegalStateException("invalid public item JSON at offset " + offset + ": " + message);
        }
    }
}
