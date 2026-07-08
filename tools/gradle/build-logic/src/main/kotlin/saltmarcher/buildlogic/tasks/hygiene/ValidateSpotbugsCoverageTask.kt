package saltmarcher.buildlogic.tasks.hygiene

import java.nio.file.Files
import javax.xml.parsers.DocumentBuilderFactory
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException

@CacheableTask
abstract class ValidateSpotbugsCoverageTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val xmlReportFile: RegularFileProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClasses: ConfigurableFileCollection

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun validateCoverage() {
        val markerPath = successMarker.get().asFile.toPath()
        Files.deleteIfExists(markerPath)

        val classCount = compiledClasses.asFileTree
            .matching { include("**/*.class") }
            .files
            .size
        val reportPath = xmlReportFile.get().asFile.toPath()
        if (!Files.isRegularFile(reportPath)) {
            throw VerificationException(
                "SpotBugs XML report was not produced: file://${reportPath.toAbsolutePath()}"
            )
        }
        if (Files.size(reportPath) == 0L) {
            throw VerificationException(
                "SpotBugs XML report is empty: file://${reportPath.toAbsolutePath()}"
            )
        }

        val reportedClassCount = parseTotalClasses(reportPath)
        if (classCount > 0 && reportedClassCount == 0) {
            throw VerificationException(
                "SpotBugs XML report analysed 0 classes while $classCount compiled production classes exist. " +
                    "The SpotBugs gate evidence is invalid: file://${reportPath.toAbsolutePath()}"
            )
        }

        Files.createDirectories(markerPath.parent)
        Files.writeString(
            markerPath,
            "compiledProductionClasses=$classCount\nspotbugsXmlTotalClasses=$reportedClassCount\n"
        )
    }

    private fun parseTotalClasses(reportPath: java.nio.file.Path): Int {
        val document = try {
            val documentBuilderFactory = DocumentBuilderFactory.newInstance()
            documentBuilderFactory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
            documentBuilderFactory.setFeature("http://xml.org/sax/features/external-general-entities", false)
            documentBuilderFactory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
            documentBuilderFactory.isExpandEntityReferences = false
            documentBuilderFactory.newDocumentBuilder().parse(reportPath.toFile())
        } catch (exception: Exception) {
            throw VerificationException(
                "SpotBugs XML report is not parseable: file://${reportPath.toAbsolutePath()}",
                exception
            )
        }
        val summaryNodes = document.getElementsByTagName("FindBugsSummary")
        if (summaryNodes.length == 0) {
            throw VerificationException(
                "SpotBugs XML report has no FindBugsSummary element: file://${reportPath.toAbsolutePath()}"
            )
        }
        val totalClasses = summaryNodes.item(0).attributes
            .getNamedItem("total_classes")
            ?.nodeValue
            ?: throw VerificationException(
                "SpotBugs XML report has no FindBugsSummary total_classes attribute: " +
                    "file://${reportPath.toAbsolutePath()}"
            )
        return totalClasses.toIntOrNull()
            ?: throw VerificationException(
                "SpotBugs XML report has non-numeric total_classes='$totalClasses': " +
                    "file://${reportPath.toAbsolutePath()}"
            )
    }
}
