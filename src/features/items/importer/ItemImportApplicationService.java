package features.items.importer;

import features.items.model.Item;
import features.items.repository.ItemRepository;
import org.jsoup.Jsoup;
import shared.crawler.slug.SlugIdentity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;

public final class ItemImportApplicationService {

    private ItemImportApplicationService() {
        throw new AssertionError("No instances");
    }

    /**
     * Parses one crawler-produced item HTML file and persists it.
     * Caller owns transaction/connection lifecycle.
     */
    public static void importFile(Path htmlFile, boolean isMagic, Connection conn) throws IOException, SQLException {
        String filename = htmlFile.getFileName().toString();
        Item item = isMagic
                ? HtmlItemParser.parseMagicItem(Jsoup.parse(Files.readString(htmlFile)))
                : HtmlItemParser.parseEquipment(Jsoup.parse(Files.readString(htmlFile)));

        item.Id = SlugIdentity.extractIdFromFilename(filename);
        item.Slug = SlugIdentity.slugFromFilename(filename);
        item.IsMagic = isMagic;
        if (item.Name == null || item.Name.isBlank()) {
            throw new IllegalStateException("No name found");
        }
        ItemRepository.save(item, conn);
    }
}
