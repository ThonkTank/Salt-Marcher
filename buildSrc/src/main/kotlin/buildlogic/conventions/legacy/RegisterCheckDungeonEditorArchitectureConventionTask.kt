package buildlogic.conventions.legacy

import java.io.File
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckDungeonEditorArchitectureConventionTask(): TaskProvider<Task> =
    tasks.register("checkDungeonEditorArchitectureConvention") {
        group = "verification"
        description = "Legacy dungeonmap migration guard for older package splits and boundaries."
        val importPattern = Regex("""^\s*import\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
        val projectRoot = layout.projectDirectory.asFile.toPath()

        doLast {
            fun importedPackages(sourceFile: File): List<String> {
                return importPattern.findAll(sourceFile.readText()).map { it.groupValues[1] }.toList()
            }

            fun packageBoundaryOffenders(sourceRoot: String, forbiddenPrefixes: List<String>): List<String> {
                return fileTree(sourceRoot) {
                    include("**/*.java")
                }.files
                    .flatMap { sourceFile ->
                        val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                        importedPackages(sourceFile)
                            .filter { imported -> forbiddenPrefixes.any(imported::startsWith) }
                            .map { imported -> "$path -> $imported" }
                    }
                    .sorted()
            }

            val legacyPackageOffenders = packageBoundaryOffenders(
                "src/features/world/dungeonmap",
                listOf("features.world.dungeonmap.editor.", "features.world.dungeonmap.runtime.", "features.world.dungeonmap.shared.")
            )
            val modelBoundaryOffenders = packageBoundaryOffenders(
                "src/features/world/dungeonmap/model",
                listOf("features.world.dungeonmap.application.", "features.world.dungeonmap.loading.", "features.world.dungeonmap.persistence.", "features.world.dungeonmap.state.", "features.world.dungeonmap.shell.", "features.world.dungeonmap.canvas.", "features.world.dungeonmap.catalog.", "features.world.dungeonmap.bootstrap.")
            )
            val applicationUiOffenders = packageBoundaryOffenders(
                "src/features/world/dungeonmap/application",
                listOf("features.world.dungeonmap.shell.", "features.world.dungeonmap.canvas.", "features.world.dungeonmap.bootstrap.")
            )
            val stateBoundaryOffenders = packageBoundaryOffenders(
                "src/features/world/dungeonmap/state",
                listOf("features.world.dungeonmap.shell.", "features.world.dungeonmap.canvas.", "features.world.dungeonmap.persistence.", "features.world.dungeonmap.bootstrap.")
            )

            if (legacyPackageOffenders.isNotEmpty() || modelBoundaryOffenders.isNotEmpty() || applicationUiOffenders.isNotEmpty() || stateBoundaryOffenders.isNotEmpty()) {
                val messages = mutableListOf<String>()
                if (legacyPackageOffenders.isNotEmpty()) {
                    messages += "Dungeonmap must not depend on the removed editor/runtime/shared package split:\n" +
                        legacyPackageOffenders.joinToString(separator = "\n") { " - $it" }
                }
                if (modelBoundaryOffenders.isNotEmpty()) {
                    messages += "Dungeon model packages must not import higher-layer dungeon packages:\n" +
                        modelBoundaryOffenders.joinToString(separator = "\n") { " - $it" }
                }
                if (applicationUiOffenders.isNotEmpty()) {
                    messages += "Dungeon application packages must not import shell/canvas/bootstrap packages:\n" +
                        applicationUiOffenders.joinToString(separator = "\n") { " - $it" }
                }
                if (stateBoundaryOffenders.isNotEmpty()) {
                    messages += "Dungeon state packages must not import shell/canvas/persistence/bootstrap packages:\n" +
                        stateBoundaryOffenders.joinToString(separator = "\n") { " - $it" }
                }
                throw GradleException(messages.joinToString(separator = "\n\n"))
            }
        }
    }
