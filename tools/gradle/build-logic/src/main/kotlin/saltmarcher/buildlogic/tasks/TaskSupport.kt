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

internal fun summarizeCkjmOutput(outputText: String): String {
    val rawLines = outputText
        .lineSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toList()

    if (rawLines.isEmpty()) {
        return "# CKJM Summary\n\nNo CKJM output was produced.\n"
    }

    data class CkjmMetricRow(
        val className: String,
        val wmc: Double,
        val cbo: Double,
        val rfc: Double,
        val lcom: Double,
        val maxCc: Double?
    )

    data class RankedMetric(
        val name: String,
        val value: Double
    )

    fun parseDouble(parts: List<String>, index: Int): Double? {
        return parts.getOrNull(index)?.toDoubleOrNull()
    }

    val metricRows = rawLines.mapNotNull { line ->
        val parts = line.split(Regex("\\s+"))
        val className = parts.firstOrNull() ?: return@mapNotNull null
        val wmc = parseDouble(parts, 1) ?: return@mapNotNull null
        val cbo = parseDouble(parts, 4) ?: return@mapNotNull null
        val rfc = parseDouble(parts, 5) ?: return@mapNotNull null
        val lcom = parseDouble(parts, 6) ?: return@mapNotNull null
        CkjmMetricRow(
            className = className,
            wmc = wmc,
            cbo = cbo,
            rfc = rfc,
            lcom = lcom,
            maxCc = parseDouble(parts, 19)
        )
    }

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
        appendLine()
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
