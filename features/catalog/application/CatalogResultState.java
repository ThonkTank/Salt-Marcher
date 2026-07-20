package features.catalog.application;

import java.util.List;
import java.util.Objects;

/** Common immutable result vocabulary for every Catalog section. */
public record CatalogResultState<Row>(Status status, List<Row> rows, String message) {

    public CatalogResultState {
        status = Objects.requireNonNull(status, "status");
        rows = List.copyOf(Objects.requireNonNull(rows, "rows"));
        message = Objects.requireNonNull(message, "message");
    }

    public static <Row> CatalogResultState<Row> uninitialized() {
        return new CatalogResultState<>(Status.UNINITIALIZED, List.of(), "");
    }

    public static <Row> CatalogResultState<Row> loading() {
        return new CatalogResultState<>(Status.LOADING, List.of(), "");
    }

    public static <Row> CatalogResultState<Row> refreshing(List<Row> rows) {
        return new CatalogResultState<>(Status.REFRESHING, rows, "");
    }

    public static <Row> CatalogResultState<Row> ready(List<Row> rows) {
        List<Row> immutableRows = List.copyOf(Objects.requireNonNull(rows, "rows"));
        return new CatalogResultState<>(immutableRows.isEmpty() ? Status.EMPTY : Status.READY, immutableRows, "");
    }

    public static <Row> CatalogResultState<Row> failed(String message) {
        return new CatalogResultState<>(Status.FAILED, List.of(), Objects.requireNonNull(message, "message"));
    }

    public static <Row> CatalogResultState<Row> failed(List<Row> retainedRows, String message) {
        return new CatalogResultState<>(
                Status.FAILED, retainedRows, Objects.requireNonNull(message, "message"));
    }

    public enum Status {
        UNINITIALIZED,
        LOADING,
        REFRESHING,
        READY,
        EMPTY,
        INVALID_INPUT,
        UNAVAILABLE,
        FAILED
    }
}
