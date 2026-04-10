package features.spells.importer;

import features.partyanalysis.api.CreatureAnalysisMaintenanceService;
import features.spells.model.Spell;
import features.spells.repository.SpellRepository;
import org.jsoup.Jsoup;
import shared.crawler.slug.SlugIdentity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;

@SuppressWarnings("unused")
public final class SpellImportApplicationService {

    private SpellImportApplicationService() {
        throw new AssertionError("No instances");
    }

    public static void importFile(Path htmlFile, Connection conn) throws IOException, SQLException {
        String filename = htmlFile.getFileName().toString();
        Spell spell = HtmlSpellParser.parse(Jsoup.parse(Files.readString(htmlFile)));
        spell.Id = SlugIdentity.extractIdFromFilename(filename);
        spell.Slug = SlugIdentity.slugFromFilename(filename);
        if (spell.Name == null || spell.Name.isBlank()) {
            throw new IllegalStateException("No spell name found");
        }
        SpellRepository.save(spell, conn);
    }

    public static void completeImport() {
        CreatureAnalysisMaintenanceService.AnalysisInputRefreshStatus refreshStatus =
                CreatureAnalysisMaintenanceService.refreshForAnalysisInputChange();
        if (refreshStatus == CreatureAnalysisMaintenanceService.AnalysisInputRefreshStatus.STORAGE_ERROR) {
            throw new IllegalStateException("Spell import completed, but analysis invalidation failed");
        }
    }
}
