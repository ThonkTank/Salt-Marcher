import java.nio.file.Files
import java.nio.file.Path

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
    implementation(files("lib/sqlite-jdbc.jar"))
    implementation(files("lib/jsoup-1.17.2.jar"))
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.17.2")
    runtimeOnly(files("lib/slf4j-api.jar"))
    runtimeOnly(files("lib/slf4j-nop.jar"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.0")
}

application {
    mainClass = "ui.SaltMarcherApp"
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}

tasks.test {
    useJUnitPlatform()
}

val crawlerMonsters by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Run monster crawler only."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "importer.MonsterCrawler"
}

val importMonsters by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Run monster importer."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "importer.MonsterImporter"
    dependsOn(crawlerMonsters)
}

val recoverEncounterTables by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Restore encounter tables from backup JSON. Pass --args='--latest' or --args='data/backups/encounter-tables-...json'."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "importer.EncounterTableRecoveryTool"
}

val recomputeRoles by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Recompute and persist creature tactical roles for all creatures."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "importer.CreatureRoleRecomputeTool"
}

val applyCreatureOverrides by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Apply versioned creature CR/XP overrides from data/creature_overrides.csv."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "importer.CreatureOverridesTool"
}

val crawlerItems by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Run item crawler only."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "features.items.importer.ItemCrawler"
}

val importItems by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Run item importer."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "features.items.importer.ItemImporter"
    dependsOn(crawlerItems)
}

val crawlerItemsSlugs by tasks.registering(JavaExec::class) {
    group = "application"
    description = "Build magic-item slug list only."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass = "features.items.importer.ItemCrawler"
    args("--build-slugs")
}

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
        """catch\s*\(\s*SQLException\b[\s\S]{0,400}?(?:System\.(?:out|err)\.println\(|return\s+(?:Optional\.empty\(\)|0L|false|null)\s*;)"""
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

tasks.named("check") {
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkNoStdStreamsInFeatureServicesAndRepositories)
    dependsOn(checkRepositorySqlExceptionConvention)
}
