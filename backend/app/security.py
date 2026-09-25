"""Password hashing and session tokens, using only the Python standard library.

Passwords: PBKDF2-HMAC-SHA256 with a random salt and many iterations (slow on purpose, so
guessing passwords from a stolen database is expensive). Stored as
"pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>".

Sessions: a random token is given to the browser; the database keeps only sha256(token).
"""
import hashlib
import hmac
import secrets

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"{ALGORITHM}${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, hash_hex = stored.split("$")
    except (ValueError, AttributeError):
        return False
    if algorithm != ALGORITHM:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    # Constant-time comparison, so response timing doesn't reveal how much matched
    return hmac.compare_digest(digest.hex(), hash_hex)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
