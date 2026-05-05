package saltmarcher.buildlogic.tasks

import org.gradle.api.GradleException
import java.io.File
import java.nio.file.FileVisitOption
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.PosixFilePermission
import java.util.Locale
import java.util.EnumSet

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

internal fun isJavafxRuntimeJar(file: File): Boolean = isJavafxRuntimeJarName(file.name)

internal fun isJavafxRuntimeJarName(fileName: String): Boolean {
    return fileName.startsWith("javafx-") && fileName.endsWith(".jar")
}

internal fun resolvePackagedAppPayloadDir(appImageDir: Path): Path {
    val jpackagePayloadDir = appImageDir.resolve("lib").resolve("app")
    if (Files.isDirectory(jpackagePayloadDir)) {
        return jpackagePayloadDir
    }

    val fallbackPayloadDir = appImageDir.resolve("app")
    if (Files.isDirectory(fallbackPayloadDir)) {
        return fallbackPayloadDir
    }

    throw GradleException("Could not resolve packaged app payload directory under $appImageDir")
}

internal fun setExecutableFile(path: Path) {
    try {
        Files.setPosixFilePermissions(
            path,
            setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE,
                PosixFilePermission.GROUP_READ,
                PosixFilePermission.GROUP_EXECUTE,
                PosixFilePermission.OTHERS_READ,
                PosixFilePermission.OTHERS_EXECUTE
            )
        )
    } catch (_: UnsupportedOperationException) {
        // Non-POSIX filesystems still get valid launchers and desktop entries without chmod support.
    }
}

internal fun resolveJpackageExecutable(): String? {
    val javaHomeJpackage = Path.of(System.getProperty("java.home"), "bin", executableName("jpackage"))
    if (Files.isRegularFile(javaHomeJpackage) && Files.isExecutable(javaHomeJpackage)) {
        return javaHomeJpackage.toString()
    }

    val pathDirectories = (System.getenv("PATH") ?: "")
        .split(File.pathSeparatorChar)
        .filter { it.isNotBlank() }
    for (directory in pathDirectories) {
        val candidate = Path.of(directory, executableName("jpackage"))
        if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) {
            return candidate.toString()
        }
    }
    return null
}

internal fun resolveDesktopDirectory(): Path {
    val userHome = Path.of(System.getProperty("user.home"))
    val xdgUserDirsFile = userHome.resolve(".config").resolve("user-dirs.dirs")
    if (Files.isRegularFile(xdgUserDirsFile)) {
        Files.readAllLines(xdgUserDirsFile)
            .asSequence()
            .map(String::trim)
            .filter { it.startsWith("XDG_DESKTOP_DIR=") }
            .map { it.substringAfter('=').trim().trim('"') }
            .map { rawPath -> rawPath.replace("\$HOME", userHome.toString()) }
            .firstOrNull { it.isNotBlank() }
            ?.let { return Path.of(it) }
    }
    val localizedDesktop = userHome.resolve("Schreibtisch")
    if (Files.isDirectory(localizedDesktop)) {
        return localizedDesktop
    }
    return userHome.resolve("Desktop")
}

internal fun copyRuntimeImage(sourceDir: Path, targetDir: Path) {
    Files.walkFileTree(sourceDir, EnumSet.of(FileVisitOption.FOLLOW_LINKS), Int.MAX_VALUE, object : SimpleFileVisitor<Path>() {
        override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
            val target = targetDir.resolve(sourceDir.relativize(dir).toString())
            Files.createDirectories(target)
            return FileVisitResult.CONTINUE
        }

        override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
            val resolvedSource = if (Files.isSymbolicLink(file)) {
                file.toRealPath()
            } else {
                file
            }
            val target = targetDir.resolve(sourceDir.relativize(file).toString())
            Files.createDirectories(target.parent)
            Files.copy(
                resolvedSource,
                target,
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.COPY_ATTRIBUTES
            )
            return FileVisitResult.CONTINUE
        }

        override fun postVisitDirectory(dir: Path, exc: java.io.IOException?): FileVisitResult {
            if (exc != null) {
                throw exc
            }
            val source = if (Files.isSymbolicLink(dir)) {
                dir.toRealPath()
            } else {
                dir
            }
            val target = targetDir.resolve(sourceDir.relativize(dir).toString())
            if (Files.exists(source, LinkOption.NOFOLLOW_LINKS)) {
                try {
                    Files.setLastModifiedTime(target, Files.getLastModifiedTime(source))
                } catch (_: UnsupportedOperationException) {
                    // Some filesystems do not support preserving directory timestamps.
                }
            }
            return FileVisitResult.CONTINUE
        }
    })
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

internal data class CkjmHotspotBaselineEntry(
    val className: String,
    val wmc: Double,
    val cbo: Double,
    val rfc: Double,
    val lcom: Double,
    val npm: Double
)

internal data class CkjmHotspotCandidate(
    val row: CkjmMetricRow,
    val score: Double,
    val attentionMetrics: List<String>,
    val extremeMetrics: List<String>
) {
    val className: String
        get() = row.className
}

internal data class CkjmHotspotRegression(
    val className: String,
    val metric: String,
    val value: Double,
    val baseline: Double,
    val allowedIncrease: Int
) {
    val valueText: String
        get() = String.format(Locale.ROOT, "%.2f", value)

    val baselineText: String
        get() = String.format(Locale.ROOT, "%.2f", baseline)
}

internal data class CkjmHotspotEvaluation(
    val metricRows: List<CkjmMetricRow>,
    val rawLineCount: Int,
    val baselineEntries: Map<String, CkjmHotspotBaselineEntry>,
    val currentHotspots: List<CkjmHotspotCandidate>,
    val blockingRegressions: List<CkjmHotspotRegression>,
    val lcomOnlyOutliers: List<CkjmMetricRow>,
    val staleBaselineEntries: List<CkjmHotspotBaselineEntry>
)

private data class CkjmHotspotMetricPolicy(
    val name: String,
    val attention: Double,
    val extreme: Double,
    val allowedIncrease: Int,
    val currentValue: (CkjmMetricRow) -> Double,
    val baselineValue: (CkjmHotspotBaselineEntry) -> Double
)

private val ckjmHotspotMetricPolicies = listOf(
    CkjmHotspotMetricPolicy("WMC", 50.0, 100.0, 5, { it.wmc }, { it.wmc }),
    CkjmHotspotMetricPolicy("CBO", 40.0, 60.0, 5, { it.cbo }, { it.cbo }),
    CkjmHotspotMetricPolicy("RFC", 120.0, 200.0, 15, { it.rfc }, { it.rfc }),
    CkjmHotspotMetricPolicy("LCOM", 500.0, 1500.0, 150, { it.lcom }, { it.lcom }),
    CkjmHotspotMetricPolicy("NPM", 40.0, 60.0, 5, { it.npm }, { it.npm })
)

private val ckjmBaselineHeader = listOf("className", "wmc", "cbo", "rfc", "lcom", "npm")

private fun formatMetric(value: Double): String {
    return String.format(Locale.ROOT, "%.2f", value)
}

private fun CkjmMetricRow.hotspotScore(): Double {
    return (wmc / 50.0) + (cbo / 40.0) + (rfc / 120.0) + (lcom / 500.0) + (npm / 40.0)
}

private fun CkjmMetricRow.toHotspotCandidateOrNull(): CkjmHotspotCandidate? {
    val attentionMetrics = ckjmHotspotMetricPolicies
        .filter { policy -> policy.currentValue(this) >= policy.attention }
        .map { it.name }
    val extremeMetrics = ckjmHotspotMetricPolicies
        .filter { policy -> policy.currentValue(this) >= policy.extreme }
        .map { it.name }
    if (attentionMetrics.size < 2 && extremeMetrics.isEmpty()) {
        return null
    }
    return CkjmHotspotCandidate(
        row = this,
        score = hotspotScore(),
        attentionMetrics = attentionMetrics,
        extremeMetrics = extremeMetrics
    )
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

internal fun parseCkjmHotspotBaseline(
    baselineText: String,
    baselinePath: Path
): Map<String, CkjmHotspotBaselineEntry> {
    val entries = linkedMapOf<String, CkjmHotspotBaselineEntry>()

    fun parseMetric(parts: List<String>, index: Int, lineNumber: Int, metric: String): Double {
        return parts.getOrNull(index)?.toDoubleOrNull()
            ?: throw GradleException("Invalid CKJM baseline $metric value at $baselinePath:$lineNumber")
    }

    baselineText.lineSequence().forEachIndexed { index, rawLine ->
        val lineNumber = index + 1
        val line = rawLine.trim()
        if (line.isEmpty() || line.startsWith("#")) {
            return@forEachIndexed
        }
        val parts = line.split(Regex("\\s+"))
        if (parts == ckjmBaselineHeader) {
            return@forEachIndexed
        }
        if (parts.size != ckjmBaselineHeader.size) {
            throw GradleException(
                "Invalid CKJM baseline row at $baselinePath:$lineNumber. " +
                    "Expected columns: ${ckjmBaselineHeader.joinToString(separator = "\t")}"
            )
        }
        val className = parts[0]
        if (entries.containsKey(className)) {
            throw GradleException("Duplicate CKJM baseline row for $className at $baselinePath:$lineNumber")
        }
        entries[className] = CkjmHotspotBaselineEntry(
            className = className,
            wmc = parseMetric(parts, 1, lineNumber, "WMC"),
            cbo = parseMetric(parts, 2, lineNumber, "CBO"),
            rfc = parseMetric(parts, 3, lineNumber, "RFC"),
            lcom = parseMetric(parts, 4, lineNumber, "LCOM"),
            npm = parseMetric(parts, 5, lineNumber, "NPM")
        )
    }
    return entries
}

internal fun evaluateCkjmHotspots(
    outputText: String,
    baselineEntries: Map<String, CkjmHotspotBaselineEntry>
): CkjmHotspotEvaluation {
    val rawLines = outputText
        .lineSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toList()

    val metricRows = parseCkjmMetricRows(outputText)
    val metricRowsByClass = metricRows.associateBy { it.className }
    val currentHotspots = metricRows
        .mapNotNull { it.toHotspotCandidateOrNull() }
        .sortedWith(
            compareByDescending<CkjmHotspotCandidate> { it.score }
                .thenBy { it.className }
        )
    val blockingRegressions = currentHotspots
        .flatMap { candidate ->
            val baseline = baselineEntries[candidate.className]
            if (baseline == null) {
                return@flatMap ckjmHotspotMetricPolicies
                    .filter { policy -> policy.currentValue(candidate.row) >= policy.attention }
                    .map { policy ->
                        CkjmHotspotRegression(
                            className = candidate.className,
                            metric = policy.name,
                            value = policy.currentValue(candidate.row),
                            baseline = 0.0,
                            allowedIncrease = 0
                        )
                    }
            }
            ckjmHotspotMetricPolicies.mapNotNull { policy ->
                val value = policy.currentValue(candidate.row)
                val baselineValue = policy.baselineValue(baseline)
                if (value > baselineValue + policy.allowedIncrease) {
                    CkjmHotspotRegression(
                        className = candidate.className,
                        metric = policy.name,
                        value = value,
                        baseline = baselineValue,
                        allowedIncrease = policy.allowedIncrease
                    )
                } else {
                    null
                }
            }
        }
        .sortedWith(
            compareByDescending<CkjmHotspotRegression> { it.value - it.baseline - it.allowedIncrease }
                .thenBy { it.className }
                .thenBy { it.metric }
        )
    val lcomOnlyOutliers = metricRows
        .filter { row ->
            row.lcom >= 500.0 && row.toHotspotCandidateOrNull() == null
        }
        .sortedWith(compareByDescending<CkjmMetricRow> { it.lcom }.thenBy { it.className })
    val staleBaselineEntries = baselineEntries.values
        .filterNot { entry -> metricRowsByClass.containsKey(entry.className) }
        .sortedBy { it.className }

    return CkjmHotspotEvaluation(
        metricRows = metricRows,
        rawLineCount = rawLines.size,
        baselineEntries = baselineEntries,
        currentHotspots = currentHotspots,
        blockingRegressions = blockingRegressions,
        lcomOnlyOutliers = lcomOnlyOutliers,
        staleBaselineEntries = staleBaselineEntries
    )
}

internal fun summarizeCkjmOutput(
    outputText: String,
    evaluation: CkjmHotspotEvaluation
): String {
    val rawLines = outputText
        .lineSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .toList()

    if (rawLines.isEmpty()) {
        return "# CKJM Summary\n\nNo CKJM output was produced.\n"
    }

    if (evaluation.metricRows.isEmpty()) {
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

    val topLevelRows = evaluation.metricRows.filterNot { it.className.contains('$') }

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

    return buildString {
        appendLine("# CKJM Summary")
        appendLine()
        appendLine("- Analysed classes: ${evaluation.metricRows.size}")
        appendLine("- Raw rows: ${evaluation.rawLineCount}")
        appendLine("- Top-level production classes considered for ranking: ${topLevelRows.size}")
        appendLine("- Baseline entries: ${evaluation.baselineEntries.size}")
        appendLine("- Current hotspot candidates: ${evaluation.currentHotspots.size}")
        appendLine("- Blocking regressions: ${evaluation.blockingRegressions.size}")
        appendLine("- LCOM-only outliers: ${evaluation.lcomOnlyOutliers.size}")
        appendLine()
        if (evaluation.blockingRegressions.isNotEmpty()) {
            appendLine("## Blocking Hotspot Regressions")
            appendLine()
            evaluation.blockingRegressions.take(50).forEach { regression ->
                appendLine(
                    "- `${regression.className}`: ${regression.metric}=${regression.valueText} " +
                        "> baseline ${regression.baselineText} + ${regression.allowedIncrease}"
                )
            }
            if (evaluation.blockingRegressions.size > 50) {
                appendLine()
                appendLine("...and ${evaluation.blockingRegressions.size - 50} more blocking regressions.")
            }
            appendLine()
        }
        if (evaluation.currentHotspots.isNotEmpty()) {
            appendLine("## Current Hotspots")
            appendLine()
            evaluation.currentHotspots.take(20).forEach { candidate ->
                appendLine(
                    "- `${candidate.className}`: score=${formatMetric(candidate.score)}, " +
                        "WMC=${formatMetric(candidate.row.wmc)}, CBO=${formatMetric(candidate.row.cbo)}, " +
                        "RFC=${formatMetric(candidate.row.rfc)}, LCOM=${formatMetric(candidate.row.lcom)}, " +
                        "NPM=${formatMetric(candidate.row.npm)}, " +
                        "attention=${candidate.attentionMetrics.joinToString(separator = ",")}, " +
                        "extreme=${candidate.extremeMetrics.joinToString(separator = ",").ifBlank { "-" }}"
                )
            }
            if (evaluation.currentHotspots.size > 20) {
                appendLine()
                appendLine("...and ${evaluation.currentHotspots.size - 20} more current hotspots.")
            }
            appendLine()
        }
        if (evaluation.lcomOnlyOutliers.isNotEmpty()) {
            appendLine("## LCOM-only Outliers")
            appendLine()
            evaluation.lcomOnlyOutliers.take(20).forEach { row ->
                appendLine(
                    "- `${row.className}`: LCOM=${formatMetric(row.lcom)}, " +
                        "WMC=${formatMetric(row.wmc)}, CBO=${formatMetric(row.cbo)}, " +
                        "RFC=${formatMetric(row.rfc)}, NPM=${formatMetric(row.npm)}"
                )
            }
            if (evaluation.lcomOnlyOutliers.size > 20) {
                appendLine()
                appendLine("...and ${evaluation.lcomOnlyOutliers.size - 20} more LCOM-only outliers.")
            }
            appendLine()
        }
        if (evaluation.staleBaselineEntries.isNotEmpty()) {
            appendLine("## Stale Baseline Entries")
            appendLine()
            evaluation.staleBaselineEntries.take(20).forEach { entry ->
                appendLine("- `${entry.className}`")
            }
            if (evaluation.staleBaselineEntries.size > 20) {
                appendLine()
                appendLine("...and ${evaluation.staleBaselineEntries.size - 20} more stale baseline entries.")
            }
            appendLine()
        }
        append(topSection("Highest WMC") { it.wmc })
        append(topSection("Highest CBO") { it.cbo })
        append(topSection("Highest RFC") { it.rfc })
        append(topSection("Highest LCOM") { it.lcom })
        append(topSection("Highest Max Cyclomatic Complexity") { it.maxCc })
    }.trimEnd() + "\n"
}
