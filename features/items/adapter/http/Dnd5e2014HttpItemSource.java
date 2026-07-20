package features.items.adapter.http;

import features.items.adapter.http.JsonDocument.JsonObject;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.PublicItemSource;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/** External GET-only adapter for the pinned public D&D 5e 2014/SRD source. */
public final class Dnd5e2014HttpItemSource implements PublicItemSource {

    public static final String API_ROOT = "https://www.dnd5eapi.co";
    public static final String API_VERSION = "2014 SRD";
    static final String EQUIPMENT_INDEX = "/api/2014/equipment";
    static final String MAGIC_ITEM_INDEX = "/api/2014/magic-items";

    private final DocumentSource source;

    public Dnd5e2014HttpItemSource(HttpClient client) {
        Objects.requireNonNull(client, "client");
        source = path -> fetch(client, path);
    }

    Dnd5e2014HttpItemSource(DocumentSource source) {
        this.source = Objects.requireNonNull(source, "source");
    }

    @Override
    public List<ImportedItem> fetchAll() {
        List<ImportedItem> items = new ArrayList<>();
        for (String detailUrl : indexUrls(EQUIPMENT_INDEX)) {
            items.add(parseEquipment(get(detailUrl)));
        }
        for (String detailUrl : indexUrls(MAGIC_ITEM_INDEX)) {
            items.add(parseMagicItem(get(detailUrl)));
        }
        return List.copyOf(items);
    }

    private List<String> indexUrls(String path) {
        JsonObject index = get(path);
        List<String> urls = new ArrayList<>();
        for (Object element : index.array("results")) {
            String detailPath = asObject(element).requiredString("url");
            if (!detailPath.startsWith(path + "/")) {
                throw new IllegalStateException("public item index returned a detail outside its pinned feed");
            }
            urls.add(detailPath);
        }
        Integer expectedCount = index.optionalInteger("count");
        if (expectedCount == null || expectedCount != urls.size()) {
            throw new IllegalStateException("public item index was incomplete");
        }
        return List.copyOf(urls);
    }

    private JsonObject get(String path) {
        try {
            return JsonDocument.parseObject(source.get(path));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("public SRD item request was interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException("public SRD item request failed", exception);
        }
    }

    private static String fetch(HttpClient client, String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(API_ROOT + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("GET " + path + " returned HTTP " + response.statusCode());
        }
        return response.body();
    }

    static ImportedItem parseEquipment(JsonObject json) {
        Cost cost = cost(json.object("cost"));
        String url = json.requiredString("url");
        return new ImportedItem(
                "equipment:" + json.requiredString("index"),
                json.requiredString("name"),
                objectName(json, "equipment_category"),
                equipmentSubcategory(json),
                false,
                "",
                false,
                cost.copperPieces(),
                cost.display(),
                json.optionalDouble("weight"),
                damage(json),
                armorClass(json),
                objectNames(json.array("properties")),
                descriptions(json),
                API_VERSION,
                API_ROOT + url);
    }

    static ImportedItem parseMagicItem(JsonObject json) {
        String description = descriptions(json);
        String url = json.requiredString("url");
        return new ImportedItem(
                "magic-item:" + json.requiredString("index"),
                json.requiredString("name"),
                objectName(json, "equipment_category"),
                "Magic Item",
                true,
                objectName(json, "rarity"),
                description.toLowerCase(Locale.ROOT).contains("requires attunement"),
                null,
                "",
                null,
                "",
                "",
                List.of(),
                description,
                API_VERSION,
                API_ROOT + url);
    }

    private static String equipmentSubcategory(JsonObject json) {
        for (String field : List.of("gear_category", "tool_category")) {
            String value = objectName(json, field);
            if (!value.isBlank()) {
                return value;
            }
        }
        for (String field : List.of("weapon_category", "armor_category", "vehicle_category")) {
            String value = json.optionalString(field);
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private static String damage(JsonObject json) {
        JsonObject damage = json.object("damage");
        if (damage == null) {
            return "";
        }
        return (damage.optionalString("damage_dice") + " " + objectName(damage, "damage_type")).trim();
    }

    private static String armorClass(JsonObject json) {
        JsonObject armor = json.object("armor_class");
        if (armor == null) {
            return "";
        }
        String base = armor.optionalString("base");
        return base.isBlank() ? "" : "AC " + base;
    }

    private static Cost cost(@Nullable JsonObject cost) {
        if (cost == null) {
            return new Cost(null, "");
        }
        Integer optionalQuantity = cost.optionalInteger("quantity");
        int quantity = optionalQuantity == null ? 0 : optionalQuantity;
        String unit = cost.optionalString("unit").toLowerCase(Locale.ROOT);
        int factor = switch (unit) {
            case "sp" -> 10;
            case "ep" -> 50;
            case "gp" -> 100;
            case "pp" -> 1000;
            default -> 1;
        };
        return new Cost(Math.multiplyExact(quantity, factor), quantity + " " + unit);
    }

    private static String descriptions(JsonObject json) {
        List<String> descriptions = new ArrayList<>();
        for (Object element : json.array("desc")) {
            if (!(element instanceof String text)) {
                throw new IllegalStateException("public item description is not text");
            }
            descriptions.add(text);
        }
        return String.join("\n\n", descriptions);
    }

    private static List<String> objectNames(List<Object> values) {
        List<String> names = new ArrayList<>();
        for (Object value : values) {
            String name = objectName(asObject(value));
            if (!name.isBlank() && !names.contains(name)) {
                names.add(name);
            }
        }
        return List.copyOf(names);
    }

    private static String objectName(JsonObject json, String field) {
        return objectName(json.object(field));
    }

    private static String objectName(@Nullable JsonObject json) {
        return json == null ? "" : json.optionalString("name");
    }

    private static JsonObject asObject(Object value) {
        if (!(value instanceof java.util.Map<?, ?> map)) {
            throw new IllegalStateException("public item array element is not an object");
        }
        java.util.Map<String, Object> values = new java.util.LinkedHashMap<>();
        map.forEach((key, entry) -> {
            if (!(key instanceof String text)) {
                throw new IllegalStateException("public item object key is not text");
            }
            values.put(text, entry);
        });
        return new JsonObject(values);
    }

    private record Cost(@Nullable Integer copperPieces, String display) {
    }

    @FunctionalInterface
    interface DocumentSource {
        String get(String path) throws IOException, InterruptedException;
    }
}
