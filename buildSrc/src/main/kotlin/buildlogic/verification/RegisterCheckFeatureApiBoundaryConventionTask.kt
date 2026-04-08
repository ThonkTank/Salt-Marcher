package buildlogic.verification

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

private data class FeatureBoundary(
    val ownerPathPrefix: String,
    val forbiddenImportPrefixes: List<String>
)

fun Project.registerCheckFeatureApiBoundaryConventionTask(): TaskProvider<Task> =
    tasks.register("checkFeatureApiBoundaryConvention") {
        group = "verification"
        description = "Legacy guard for older feature api/service/repository boundary rules."
        val projectRoot = layout.projectDirectory.asFile.toPath()
        val importPattern = Regex("""^\s*import\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
        val boundaries = listOf(
            FeatureBoundary("features/encounter/", listOf("features.encounter.service.", "features.encounter.repository.", "features.encounter.ui.", "features.encounter.internal.", "features.encounter.partyanalysis.api.")),
            FeatureBoundary("features/encountertable/", listOf("features.encountertable.service.", "features.encountertable.repository.", "features.encountertable.ui.", "features.encountertable.recovery.")),
            FeatureBoundary("features/loottable/", listOf("features.loottable.service.", "features.loottable.repository.", "features.loottable.ui.")),
            FeatureBoundary("features/party/", listOf("features.party.service.", "features.party.repository.", "features.party.ui.")),
            FeatureBoundary("features/world/hexmap/", listOf("features.world.hexmap.service.", "features.world.hexmap.repository.", "features.world.hexmap.ui.")),
            FeatureBoundary("features/creatures/", listOf("features.creatures.application.", "features.creatures.repository.", "features.creatures.service.", "features.creatures.ui.", "features.creatures.maintenance.")),
            FeatureBoundary("features/partyanalysis/", listOf("features.partyanalysis.application.", "features.partyanalysis.repository.", "features.partyanalysis.service.")),
            FeatureBoundary("features/items/", listOf("features.items.service.", "features.items.repository.", "features.items.model.", "features.items.ui.shared.", "features.items.importer.")),
            FeatureBoundary("features/campaignstate/", listOf("features.campaignstate.repository."))
        )

        doLast {
            val offenders = fileTree("src") {
                include("features/**/*.java")
                include("ui/**/*.java")
            }.files
                .flatMap { sourceFile ->
                    val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                    val relativePath = path.removePrefix("src/")
                    val imports = importPattern.findAll(sourceFile.readText()).map { it.groupValues[1] }.toList()
                    boundaries.flatMap { boundary ->
                        if (relativePath.startsWith(boundary.ownerPathPrefix)) {
                            emptyList()
                        } else {
                            imports.filter { imported -> boundary.forbiddenImportPrefixes.any(imported::startsWith) }
                                .map { imported -> "$path -> $imported" }
                        }
                    }
                }
                .sorted()

            if (offenders.isNotEmpty()) {
                val details = offenders.joinToString(separator = "\n") { " - $it" }
                throw GradleException(
                    "Feature API boundary drift detected.\n" +
                        "Cross-feature consumers must go through the owning feature's api package.\n" +
                        "Offending imports:\n$details"
                )
            }
        }
    }
