package saltmarcher.buildlogic.tasks

import org.gradle.api.GradleException
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.util.Locale

internal fun executableName(command: String): String {
    return if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
        "$command.exe"
    } else {
        command
    }
}

internal fun resolveExecutableOnPath(command: String): String? {
    val pathDirectories = (System.getenv("PATH") ?: "")
        .split(File.pathSeparatorChar)
        .filter { it.isNotBlank() }
    for (directory in pathDirectories) {
        val candidate = Path.of(directory, executableName(command))
        if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) {
            return candidate.toString()
        }
    }
    return null
}

internal fun resolveJavaExecutable(): Path {
    val javaPath = Path.of(System.getProperty("java.home"), "bin", executableName("java"))
    if (!Files.isRegularFile(javaPath) || !Files.isExecutable(javaPath)) {
        throw GradleException("Java executable not found: $javaPath")
    }
    return javaPath
}

internal fun resolveVenvPythonExecutable(venvPath: Path): Path {
    val scriptPath = if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
        venvPath.resolve("Scripts").resolve(executableName("python"))
    } else {
        venvPath.resolve("bin").resolve(executableName("python"))
    }
    if (!Files.isRegularFile(scriptPath) || !Files.isExecutable(scriptPath)) {
        throw GradleException("Lizard virtualenv Python executable not found: $scriptPath")
    }
    return scriptPath
}

internal data class CkjmMetricRow(
    val className: String,
    val wmc: Double,
    val dit: Double,
    val noc: Double,
    val cbo: Double,
    val rfc: Double,
    val lcom: Double,
    val ca: Double,
    val npm: Double,
    val maxCc: Double?
)

internal data class CkjmThresholds(
    val wmc: Int,
    val dit: Int,
    val noc: Int,
    val cbo: Int,
    val rfc: Int,
    val lcom: Int,
    val ca: Int,
    val npm: Int
)

internal data class CkjmThresholdViolation(
    val className: String,
    val metric: String,
    val value: Double,
    val threshold: Int
) {
    val valueText: String
        get() = String.format(Locale.ROOT, "%.2f", value)
}

internal fun parseCkjmMetricRows(outputText: String): List<CkjmMetricRow> {
    val rawLines = outputText
        .lineSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toList()

    fun parseDouble(parts: List<String>, index: Int): Double? {
        return parts.getOrNull(index)?.toDoubleOrNull()
    }

    return rawLines.mapNotNull { line ->
        val parts = line.split(Regex("\\s+"))
        val className = parts.firstOrNull() ?: return@mapNotNull null
        CkjmMetricRow(
            className = className,
            wmc = parseDouble(parts, 1) ?: return@mapNotNull null,
            dit = parseDouble(parts, 2) ?: return@mapNotNull null,
            noc = parseDouble(parts, 3) ?: return@mapNotNull null,
            cbo = parseDouble(parts, 4) ?: return@mapNotNull null,
            rfc = parseDouble(parts, 5) ?: return@mapNotNull null,
            lcom = parseDouble(parts, 6) ?: return@mapNotNull null,
            ca = parseDouble(parts, 7) ?: return@mapNotNull null,
            npm = parseDouble(parts, 8) ?: return@mapNotNull null,
            maxCc = parseDouble(parts, 19)
        )
    }
}

internal fun findCkjmThresholdViolations(
    outputText: String,
    thresholds: CkjmThresholds
): List<CkjmThresholdViolation> {
    return parseCkjmMetricRows(outputText)
        .flatMap { row ->
            listOf(
                CkjmThresholdViolation(row.className, "WMC", row.wmc, thresholds.wmc),
                CkjmThresholdViolation(row.className, "DIT", row.dit, thresholds.dit),
                CkjmThresholdViolation(row.className, "NOC", row.noc, thresholds.noc),
                CkjmThresholdViolation(row.className, "CBO", row.cbo, thresholds.cbo),
                CkjmThresholdViolation(row.className, "RFC", row.rfc, thresholds.rfc),
                CkjmThresholdViolation(row.className, "LCOM", row.lcom, thresholds.lcom),
                CkjmThresholdViolation(row.className, "Ca", row.ca, thresholds.ca),
                CkjmThresholdViolation(row.className, "NPM", row.npm, thresholds.npm)
            )
        }
        .filter { violation -> violation.value > violation.threshold }
        .sortedWith(
            compareByDescending<CkjmThresholdViolation> { it.value - it.threshold }
                .thenBy { it.className }
                .thenBy { it.metric }
        )
}

internal fun summarizeCkjmOutput(
    outputText: String,
    thresholds: CkjmThresholds? = null,
    thresholdViolations: List<CkjmThresholdViolation> = emptyList()
): String {
    val rawLines = outputText
        .lineSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toList()

    if (rawLines.isEmpty()) {
        return "# CKJM Summary\n\nNo CKJM output was produced.\n"
    }

    data class RankedMetric(
        val name: String,
        val value: Double
    )

    val metricRows = parseCkjmMetricRows(outputText)

    if (metricRows.isEmpty()) {
        val preview = rawLines.take(20).joinToString(separator = "\n") { "- `$it`" }
        return buildString {
            appendLine("# CKJM Summary")
            appendLine()
            appendLine("CKJM produced output, but the rows did not match the expected metric format.")
            appendLine()
            appendLine("## Raw Preview")
            appendLine(preview)
            if (rawLines.size > 20) {
                appendLine()
                appendLine("...and ${rawLines.size - 20} more rows.")
            }
        }
    }

    val topLevelRows = metricRows.filterNot { it.className.contains('$') }

    fun topMetrics(selector: (CkjmMetricRow) -> Double?): List<Pair<CkjmMetricRow, Double>> {
        return topLevelRows
            .mapNotNull { row -> selector(row)?.let { value -> row to value } }
            .sortedByDescending { (_, value) -> value }
            .take(5)
    }

    fun topSection(title: String, selector: (CkjmMetricRow) -> Double?): String {
        val topRows = topMetrics(selector)
        if (topRows.isEmpty()) {
            return ""
        }
        return buildString {
            appendLine("## $title")
            appendLine()
            topRows.forEach { (row, value) ->
                appendLine("- `${row.className}`: ${String.format(Locale.ROOT, "%.2f", value)}")
            }
            appendLine()
        }
    }

    val hotspotMetrics = linkedMapOf(
        "WMC" to topMetrics { it.wmc },
        "CBO" to topMetrics { it.cbo },
        "RFC" to topMetrics { it.rfc },
        "LCOM" to topMetrics { it.lcom }
    )

    val multiMetricHotspots = hotspotMetrics
        .flatMap { (metricName, rows) ->
            rows.map { (row, value) -> row.className to RankedMetric(metricName, value) }
        }
        .groupBy({ (className, _) -> className }, { (_, metric) -> metric })
        .mapValues { (_, metrics) -> metrics.sortedByDescending { it.value } }
        .filterValues { metrics -> metrics.size >= 2 }
        .toList()
        .sortedWith(
            compareByDescending<Pair<String, List<RankedMetric>>> { (_, metrics) -> metrics.size }
                .thenByDescending { (_, metrics) -> metrics.sumOf { metric -> metric.value } }
                .thenBy { (className, _) -> className }
        )

    return buildString {
        appendLine("# CKJM Summary")
        appendLine()
        appendLine("- Analysed classes: ${metricRows.size}")
        appendLine("- Raw rows: ${rawLines.size}")
        appendLine("- Top-level production classes considered for ranking: ${topLevelRows.size}")
        if (thresholds != null) {
            appendLine(
                "- Thresholds: WMC<=${thresholds.wmc}, DIT<=${thresholds.dit}, " +
                    "NOC<=${thresholds.noc}, CBO<=${thresholds.cbo}, RFC<=${thresholds.rfc}, " +
                    "LCOM<=${thresholds.lcom}, Ca<=${thresholds.ca}, NPM<=${thresholds.npm}"
            )
            appendLine("- Threshold violations: ${thresholdViolations.size}")
        }
        appendLine()
        if (thresholdViolations.isNotEmpty()) {
            appendLine("## Threshold Violations")
            appendLine()
            thresholdViolations.take(50).forEach { violation ->
                appendLine(
                    "- `${violation.className}`: ${violation.metric}=${violation.valueText} " +
                        "> ${violation.threshold}"
                )
            }
            if (thresholdViolations.size > 50) {
                appendLine()
                appendLine("...and ${thresholdViolations.size - 50} more threshold violations.")
            }
            appendLine()
        }
        append(topSection("Highest WMC") { it.wmc })
        append(topSection("Highest CBO") { it.cbo })
        append(topSection("Highest RFC") { it.rfc })
        append(topSection("Highest LCOM") { it.lcom })
        append(topSection("Highest Max Cyclomatic Complexity") { it.maxCc })
        if (multiMetricHotspots.isNotEmpty()) {
            appendLine("## Multi-metric Hotspots")
            appendLine()
            multiMetricHotspots.forEach { (className, metrics) ->
                val metricText = metrics.joinToString(", ") { metric ->
                    "${metric.name}=${String.format(Locale.ROOT, "%.2f", metric.value)}"
                }
                appendLine("- `${className}`: $metricText")
            }
            appendLine()
        }
    }.trimEnd() + "\n"
}
