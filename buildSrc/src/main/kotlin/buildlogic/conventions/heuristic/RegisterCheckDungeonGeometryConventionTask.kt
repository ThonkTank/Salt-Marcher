package buildlogic.conventions.heuristic

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckDungeonGeometryConventionTask(): TaskProvider<Task> =
    tasks.register("checkDungeonGeometryConvention") {
        group = "verification"
        description = "Heuristic guard for canonical dungeon geometry carriers on public/protected seams."

        val projectRoot = layout.projectDirectory.asFile.toPath()
        val allowedRawGeometryCarrierFiles = setOf(
            "src/features/world/dungeon/geometry/GridArea.java",
            "src/features/world/dungeon/geometry/GridBoundary.java",
            "src/features/world/dungeon/geometry/GridPath.java",
            "src/features/world/dungeon/geometry/GridSegmentPath.java"
        )
        val rawGeometryTypePattern = Regex("""\b(?:Collection|List|Set)<Grid(?:Point|Segment)>""")
        val forbiddenGeometryDialectPattern = Regex("""\b(?:[A-Za-z0-9_]*2x|movedBy|translatedBy|touchingCells|occupiedPositions|boundarySegments|cellX|cellY)\b""")

        fun signatureBlocks(sourceText: String): List<String> {
            val lines = sourceText.lines()
            val blocks = mutableListOf<String>()
            var index = 0
            while (index < lines.size) {
                val line = lines[index].trim()
                if (!line.startsWith("public ") && !line.startsWith("protected ")) {
                    index++
                    continue
                }
                val block = StringBuilder(line)
                while (!block.contains("{") && !block.contains(";") && index + 1 < lines.size) {
                    index++
                    block.append(' ').append(lines[index].trim())
                }
                blocks += block.toString()
                index++
            }
            return blocks
        }

        doLast {
            val offenders = fileTree("src/features/world/dungeon") {
                include("**/*.java")
            }.files
                .flatMap { sourceFile ->
                    val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                    signatureBlocks(sourceFile.readText()).flatMap { signature ->
                        val problems = mutableListOf<String>()
                        if (path !in allowedRawGeometryCarrierFiles && rawGeometryTypePattern.containsMatchIn(signature)) {
                            problems += "public/protected seam exposes raw GridPoint/GridSegment collections"
                        }
                        if (forbiddenGeometryDialectPattern.containsMatchIn(signature)) {
                            problems += "public/protected seam reintroduces forbidden geometry dialect"
                        }
                        problems.map { problem -> "$path -> $problem -> $signature" }
                    }
                }
                .sorted()

            if (offenders.isNotEmpty()) {
                val details = offenders.joinToString(separator = "\n") { " - $it" }
                throw GradleException(
                    "Dungeon geometry convention drift detected.\n" +
                        "Public and protected dungeon seams must use the canonical geometry carriers and names.\n" +
                        "Offending signatures:\n$details"
                )
            }
        }
    }
