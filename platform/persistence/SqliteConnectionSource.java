package platform.persistence;

import java.sql.Connection;
import java.sql.SQLException;

@FunctionalInterface
public interface SqliteConnectionSource {

    Connection openConnection() throws SQLException;
}
