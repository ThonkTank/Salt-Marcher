#!/usr/bin/env bash

sm_is_sensitive_build_path() {
    local path="${1#./}"

    case "$path" in
        build.gradle.kts|CODEOWNERS)
            return 0
            ;;
    esac

    if [[ "$path" == buildSrc/src/main/kotlin/buildlogic/conventions/* ]]; then
        return 0
    fi

    return 1
}
