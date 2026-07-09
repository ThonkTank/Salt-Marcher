import org.gradle.jvm.tasks.Jar

plugins {
    `kotlin-dsl`
    `java-gradle-plugin`
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

dependencies {
    implementation("net.ltgt.errorprone:net.ltgt.errorprone.gradle.plugin:5.1.0")
}

gradlePlugin {
    plugins {
        register("saltmarcherQualityConventions") {
            id = "saltmarcher.quality-conventions"
            implementationClass = "saltmarcher.buildlogic.verification.SaltmarcherQualityConventionsPlugin"
        }
        register("saltmarcherVerificationCore") {
            id = "saltmarcher.verification-core"
            implementationClass = "saltmarcher.buildlogic.verification.SaltmarcherVerificationCorePlugin"
        }
    }
}

tasks.named<Jar>("jar") {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
