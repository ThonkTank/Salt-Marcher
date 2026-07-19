package features.sessionplanner.application;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

final class CanonicalSha256DigestWriter {

    private final MessageDigest digest;

    CanonicalSha256DigestWriter() {
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 fingerprinting is unavailable", exception);
        }
    }

    CanonicalSha256DigestWriter writeBoolean(boolean value) {
        digest.update((byte) (value ? 1 : 0));
        return this;
    }

    CanonicalSha256DigestWriter writeInt(int value) {
        digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(value).array());
        return this;
    }

    CanonicalSha256DigestWriter writeLong(long value) {
        digest.update(ByteBuffer.allocate(Long.BYTES).putLong(value).array());
        return this;
    }

    CanonicalSha256DigestWriter writeText(String value) {
        byte[] encoded = value.getBytes(StandardCharsets.UTF_8);
        writeInt(encoded.length);
        digest.update(encoded);
        return this;
    }

    String finishV1() {
        return "v1:" + java.util.HexFormat.of().formatHex(digest.digest());
    }
}
