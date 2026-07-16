package src.domain.sessiongeneration;

import java.util.List;
import java.util.Map;

public interface SessionGenerationCatalog {

    List<Map<String, String>> table(String name);

    String contentHash();
}
