package features.items.domain.importing;

import java.time.Instant;

public interface ItemImportStore {

    void initialize();

    BackupReceipt createVerifiedBackup();

    void replaceAll(ItemImportBatch batch);

    record BackupReceipt(Instant createdAt) {
        public BackupReceipt {
            if (createdAt == null) {
                throw new IllegalArgumentException("createdAt");
            }
        }
    }
}
