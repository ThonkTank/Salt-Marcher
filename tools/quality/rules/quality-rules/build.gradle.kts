import java.io.File

plugins {
    `java-library`
}

group = "saltmarcher.quality"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile.parentFile

apply(from = repoRootDir.resolve("tools/quality/enforcement-bundles.gradle.kts"))

@Suppress("UNCHECKED_CAST")
val activeEnforcementBundleIds = extra["saltmarcherActiveEnforcementBundleIds"] as List<String>
@Suppress("UNCHECKED_CAST")
val pmdHostScriptsByBundleId = extra["saltmarcherPmdHostScriptsByBundleId"] as Map<String, String>

activeEnforcementBundleIds
    .mapNotNull(pmdHostScriptsByBundleId::get)
    .distinct()
    .forEach { scriptPath ->
        apply(from = File(scriptPath))
    }

dependencies {
    implementation("net.sourceforge.pmd:pmd-java:7.23.0")
}
