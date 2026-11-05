import hashlib
import re


def content_hash(question_text: str) -> str:
    """Idempotency key for a question: SHA-256 of its whitespace-normalised text."""
    normalised = re.sub(r"\s+", " ", question_text).strip()
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()
