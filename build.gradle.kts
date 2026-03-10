import java.nio.file.Files
import java.nio.file.Path
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.JavaExec

plugins {
    java
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

javafx {
    version = "21.0.2"
    modules = listOf("javafx.controls")
}

sourceSets {
    main {
        java {
            setSrcDirs(listOf("src"))
            exclude("test/**")
        }
        resources {
            setSrcDirs(listOf("resources"))
        }
    }
}

dependencies {
    implementation("org.xerial:sqlite-jdbc:3.45.1.0")
    implementation("org.jsoup:jsoup:1.17.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.17.2")
    runtimeOnly("org.slf4j:slf4j-api:2.0.9")
    runtimeOnly("org.slf4j:slf4j-nop:2.0.9")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.0")
}

application {
    mainClass = "ui.bootstrap.SaltMarcherApp"
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}

tasks.test {
    useJUnitPlatform()
}

fun registerJavaExecTask(
    taskName: String,
    taskDescription: String,
    taskMainClass: String,
    dependsOnTask: TaskProvider<*>? = null,
    taskArgs: List<String> = emptyList()
): TaskProvider<JavaExec> = tasks.register<JavaExec>(taskName) {
    group = "application"
    description = taskDescription
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = taskMainClass
    if (dependsOnTask != null) {
        dependsOn(dependsOnTask)
    }
    if (taskArgs.isNotEmpty()) {
        args(taskArgs)
    }
}

val crawlerMonsters = registerJavaExecTask(
    taskName = "crawlerMonsters",
    taskDescription = "Run monster crawler only.",
    taskMainClass = "importer.MonsterCrawler"
)

val importMonsters = registerJavaExecTask(
    taskName = "importMonsters",
    taskDescription = "Run monster importer.",
    taskMainClass = "importer.MonsterImporter",
    dependsOnTask = crawlerMonsters
)

val recoverEncounterTables = registerJavaExecTask(
    taskName = "recoverEncounterTables",
    taskDescription = "Restore encounter tables from backup JSON. Pass --args='--latest' or --args='data/backups/encounter-tables-...json'.",
    taskMainClass = "importer.EncounterTableRecoveryTool"
)

val backfillCreatureAnalysis = registerJavaExecTask(
    taskName = "backfillCreatureAnalysis",
    taskDescription = "Reimport crawled monsters from stored HTML and refresh encounter-analysis caches.",
    taskMainClass = "importer.CreatureAnalysisBackfillTool"
)

val applyCreatureOverrides = registerJavaExecTask(
    taskName = "applyCreatureOverrides",
    taskDescription = "Apply versioned creature CR/XP overrides from data/creature_overrides.csv.",
    taskMainClass = "importer.CreatureOverridesTool"
)

val crawlerItems = registerJavaExecTask(
    taskName = "crawlerItems",
    taskDescription = "Run item crawler only.",
    taskMainClass = "features.items.importer.ItemCrawler"
)

val importItems = registerJavaExecTask(
    taskName = "importItems",
    taskDescription = "Run item importer.",
    taskMainClass = "features.items.importer.ItemImporter",
    dependsOnTask = crawlerItems
)

val crawlerItemsSlugs = registerJavaExecTask(
    taskName = "crawlerItemsSlugs",
    taskDescription = "Build magic-item slug list only.",
    taskMainClass = "features.items.importer.ItemCrawler",
    taskArgs = listOf("--build-slugs")
)

tasks.register("crawler") {
    group = "application"
    description = "Run monster crawler + importer."
    dependsOn(importMonsters)
}

tasks.register("crawlerItemsPipeline") {
    group = "application"
    description = "Run item crawler + importer."
    dependsOn(importItems)
}

val checkNoCompiledArtifactsInSource by tasks.registering {
    group = "verification"
    description = "Fail if compiled .class artifacts are present inside src/."

    doLast {
        val sourceRoot = project.layout.projectDirectory.dir("src").asFile.toPath()
        val offendingFiles = Files.walk(sourceRoot)
            .use { paths: java.util.stream.Stream<Path> ->
                paths
                    .filter { path -> Files.isRegularFile(path) && path.fileName.toString().endsWith(".class") }
                    .map { sourceRoot.relativize(it).toString().replace('\\', '/') }
                    .sorted()
                    .toList()
            }

        if (offendingFiles.isNotEmpty()) {
            val details = offendingFiles.joinToString(separator = "\n") { " - src/$it" }
            throw GradleException(
                "Compiled artifacts found in src/.\n" +
                    "Remove them with: find src -name '*.class' -delete\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkNoStdStreamsInFeatureServicesAndRepositories by tasks.registering {
    group = "verification"
    description = "Fail on new System.out/System.err usage in feature service/repository code."
    val stdStreamPattern = Regex("""System\.(?:out|err)\.println\(""")

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src/features") {
            include("**/service/**/*.java")
            include("**/repository/**/*.java")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path -> stdStreamPattern.containsMatchIn(file(path).readText()) }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "New System.out/System.err usage detected in feature service/repository code.\n" +
                    "Use structured logging or UI/service-level error reporting helpers.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkRepositorySqlExceptionConvention by tasks.registering {
    group = "verification"
    description = "Fail when new repositories catch and likely swallow SQLException."
    val sqlCatchPattern = Regex("""catch\s*\(\s*SQLException\b""")
    val sqlSwallowPattern = Regex(
        """catch\s*\(\s*SQLException\b[\s\S]*?(?:System\.(?:out|err)\.println\(|return\s+(?:Optional\.empty\(\)|0L|false|null)\s*;)[\s\S]*?\}"""
    )

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src/features") {
            include("**/repository/*Repository.java")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path ->
                val content = file(path).readText()
                sqlCatchPattern.containsMatchIn(content)
                    && sqlSwallowPattern.containsMatchIn(content)
            }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Repository SQL contract drift detected.\n" +
                    "Repositories should propagate SQLException and let service/application layers decide fallback behavior.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkUiAsyncSubmissionConvention by tasks.registering {
    group = "verification"
    description = "Fail when UI code bypasses UiAsyncTasks and calls UiAsyncExecutor.submit directly."
    val directExecutorPattern = Regex("""\bUiAsyncExecutor\.submit\(""")

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src") {
            include("**/*.java")
            exclude("ui/async/**")
        }.files
            .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
            .filter { path -> directExecutorPattern.containsMatchIn(file(path).readText()) }
            .sorted()

        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "UI async submission convention drift detected.\n" +
                    "Use UiAsyncTasks.submit(...) as the public entrypoint; keep UiAsyncExecutor.submit(...) internal to ui.async.\n" +
                    "Offending files:\n$details"
            )
        }
    }
}

val checkFeatureApiBoundaryConvention by tasks.registering {
    group = "verification"
    description = "Fail when cross-feature consumers bypass feature api packages."

    data class FeatureBoundary(
        val ownerPathPrefix: String,
        val forbiddenImportPrefixes: List<String>
    )

    val importPattern = Regex("""^\s*import\s+([a-zA-Z0-9_.]+);""", RegexOption.MULTILINE)
    val boundaries = listOf(
        FeatureBoundary(
            ownerPathPrefix = "features/encounter/",
            forbiddenImportPrefixes = listOf(
                "features.encounter.service.",
                "features.encounter.repository.",
                "features.encounter.ui.",
                "features.encounter.internal.",
                "features.encounter.partyanalysis.api."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/encountertable/",
            forbiddenImportPrefixes = listOf(
                "features.encountertable.service.",
                "features.encountertable.repository.",
                "features.encountertable.ui.",
                "features.encountertable.recovery."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/party/",
            forbiddenImportPrefixes = listOf(
                "features.party.service.",
                "features.party.repository.",
                "features.party.ui."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/world/hexmap/",
            forbiddenImportPrefixes = listOf(
                "features.world.hexmap.service.",
                "features.world.hexmap.repository.",
                "features.world.hexmap.ui."
            )
        ),
        FeatureBoundary(
            ownerPathPrefix = "features/creatures/",
            forbiddenImportPrefixes = listOf(
                "features.creatures.application.",
                "features.creatures.repository.",
                "features.creatures.service.",
                "features.creatures.ui.",
                "features.creatures.maintenance."
            )
        )
    )

    doLast {
        val projectRoot = project.layout.projectDirectory.asFile.toPath()
        val offenders = fileTree("src") {
            include("features/**/*.java")
            include("ui/**/*.java")
        }.files
            .flatMap { sourceFile ->
                val path = projectRoot.relativize(sourceFile.toPath()).toString().replace('\\', '/')
                val relativePath = path.removePrefix("src/")
                val imports = importPattern.findAll(sourceFile.readText())
                    .map { it.groupValues[1] }
                    .toList()
                boundaries.flatMap { boundary ->
                    if (relativePath.startsWith(boundary.ownerPathPrefix)) {
                        emptyList()
                    } else {
                        imports.filter { imported ->
                            boundary.forbiddenImportPrefixes.any(imported::startsWith)
                        }.map { imported -> "$path -> $imported" }
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

tasks.named("check") {
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkNoStdStreamsInFeatureServicesAndRepositories)
    dependsOn(checkRepositorySqlExceptionConvention)
    dependsOn(checkUiAsyncSubmissionConvention)
    dependsOn(checkFeatureApiBoundaryConvention)
}
