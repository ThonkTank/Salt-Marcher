import java.io.File
import org.gradle.jvm.tasks.Jar

plugins {
    `kotlin-dsl`
    `java-gradle-plugin`
    `maven-publish`
}

repositories {
    gradlePluginPortal()
    mavenCentral()
}

group = "saltmarcher.tooling"
version = providers.systemProperty("saltmarcher.toolingPluginVersion")
    .orElse(providers.environmentVariable("SALTMARCHER_TOOLING_PLUGIN_VERSION"))
    .orElse("1.0-SNAPSHOT")
    .get()

kotlin {
    jvmToolchain(21)
}

gradlePlugin {
    plugins {
        register("saltmarcherSettings") {
            id = "saltmarcher.settings"
            implementationClass = "saltmarcher.buildlogic.settings.SaltmarcherRootSettingsPlugin"
        }
    }
}

publishing {
    repositories {
        providers.systemProperty("saltmarcher.toolingPluginRepo")
            .orElse(providers.environmentVariable("SALTMARCHER_TOOLING_PLUGIN_REPO"))
            .orNull
            ?.let { repoPath ->
                maven {
                    name = "saltmarcherTooling"
                    url = uri(File(repoPath))
                }
            }
    }
}

tasks.named<Jar>("jar") {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
