import hashlib
import re
import time


def content_hash(question_text: str) -> str:
    """Idempotency key for a question: SHA-256 of its whitespace-normalised text."""
    normalised = re.sub(r"\s+", " ", question_text).strip()
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


class EmbeddingRateLimited(Exception):
    """The embedding API answered 429. `retry_after` is the server's hint in seconds, if any."""

    def __init__(self, retry_after: float | None = None):
        self.retry_after = retry_after
        super().__init__("embedding API rate limited")


def embed_with_backoff(embed, texts, *, max_retries=5, base_delay=2.0, sleep=time.sleep):
    """Call `embed(texts)`, waiting and retrying while the API rate-limits us.

    Waits `base_delay * 2**attempt` seconds unless the server named its own wait.
    """
    for attempt in range(max_retries + 1):
        try:
            return embed(texts)
        except EmbeddingRateLimited as exc:
            if attempt == max_retries:
                raise
            sleep(exc.retry_after if exc.retry_after is not None else base_delay * 2**attempt)
