import os
import base64
from cryptography.fernet import Fernet

_KEY_ENV = "FOLIANTICA_SECRET_KEY"
_KEY_FILE = ".secret_key"


def _load_or_create_key() -> bytes:
    env_key = os.environ.get(_KEY_ENV)
    if env_key:
        return base64.urlsafe_b64decode(env_key)

    if os.path.exists(_KEY_FILE):
        with open(_KEY_FILE, "rb") as f:
            return f.read().strip()

    key = Fernet.generate_key()
    with open(_KEY_FILE, "wb") as f:
        f.write(key)
    return key


_fernet = Fernet(_load_or_create_key())


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()
