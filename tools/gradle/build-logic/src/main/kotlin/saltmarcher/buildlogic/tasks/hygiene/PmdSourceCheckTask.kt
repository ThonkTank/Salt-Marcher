package saltmarcher.buildlogic.tasks.hygiene

import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.api.tasks.CacheableTask
import java.nio.file.Path
import java.nio.file.Files
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import javax.xml.stream.XMLStreamReader

@CacheableTask
abstract class PmdSourceCheckTask : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val xmlReportFile: RegularFileProperty

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @TaskAction
    fun writeTextReport() {
        val xmlReportPath = xmlReportFile.get().asFile.toPath()
        val reportPath = reportFile.get().asFile.toPath()
        if (!Files.exists(xmlReportPath)) {
            throw VerificationException("PMD XML report is missing: file://${xmlReportPath.toAbsolutePath()}")
        }
        Files.createDirectories(reportPath.parent)

        val findings = parsePmdXml(xmlReportPath)
        val projectRootPath = projectRoot.get().asFile.toPath()
        val reportText = findings.joinToString(System.lineSeparator()) { finding ->
            finding.toReportLine(projectRootPath)
        }
        Files.writeString(reportPath, reportText.withTrailingLine())

        if (findings.isNotEmpty()) {
            println(reportText)
            logger.warn(
                "PMD source-smell report contains violations or analysis diagnostics. " +
                    "See the report at: file://${reportPath.toAbsolutePath()}"
            )
            throw VerificationException(
                "PMD source-smell violations were found. See the report at: " +
                    "file://${reportPath.toAbsolutePath()}"
            )
        }
    }

    private fun parsePmdXml(xmlReportPath: Path): List<PmdFinding> {
        val xmlFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
            setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "")
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
        }
        return Files.newInputStream(xmlReportPath).use { input ->
            val reader = xmlFactory.createXMLStreamReader(input)
            try {
                readPmdFindings(reader)
            } finally {
                reader.close()
            }
        }
    }

    private fun readPmdFindings(reader: XMLStreamReader): List<PmdFinding> {
        val findings = mutableListOf<PmdFinding>()
        var currentFile = ""
        while (reader.hasNext()) {
            if (reader.next() == XMLStreamConstants.START_ELEMENT) {
                when (reader.localName) {
                    "file" -> currentFile = reader.attribute("name")
                    "violation" -> findings += readViolation(reader, currentFile)
                    "error" -> findings += readError(reader)
                    "configerror" -> findings += readConfigError(reader)
                }
            }
        }
        return findings
    }

    private fun readViolation(reader: XMLStreamReader, currentFile: String): PmdFinding {
        val fileName = currentFile.ifBlank { reader.attribute("filename") }
        val line = reader.attribute("beginline").ifBlank { "1" }
        val rule = reader.attribute("rule").ifBlank { "PMD" }
        val message = reader.getElementText().trim()
        return PmdFinding(fileName, line, rule, message)
    }

    private fun readError(reader: XMLStreamReader): PmdFinding {
        val fileName = reader.attribute("filename")
        val message = reader.attribute("msg").ifBlank { reader.getElementText().trim() }
        return PmdFinding(fileName, "1", "PMDError", message)
    }

    private fun readConfigError(reader: XMLStreamReader): PmdFinding {
        val rule = reader.attribute("rule").ifBlank { "PMDConfigError" }
        val message = reader.attribute("msg").ifBlank { reader.getElementText().trim() }
        return PmdFinding("", "1", rule, message)
    }

    private fun XMLStreamReader.attribute(name: String): String = getAttributeValue(null, name).orEmpty()
}

private data class PmdFinding(
    val fileName: String,
    val line: String,
    val rule: String,
    val message: String
) {
    fun toReportLine(projectRoot: Path): String = "${relativeFileName(projectRoot)}:$line:\t$rule:\t${message.singleLine()}"

    private fun relativeFileName(projectRoot: Path): String {
        if (fileName.isBlank()) {
            return fileName
        }
        val filePath = Path.of(fileName)
        return if (filePath.isAbsolute && filePath.startsWith(projectRoot)) {
            projectRoot.relativize(filePath).toString()
        } else {
            fileName
        }.replace('\\', '/')
    }
}

private fun String.singleLine(): String = lineSequence()
    .map(String::trim)
    .filter(String::isNotEmpty)
    .joinToString(" ")

private fun String.withTrailingLine(): String = if (isBlank()) "" else "$this${System.lineSeparator()}"
