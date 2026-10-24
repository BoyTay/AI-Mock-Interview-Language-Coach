import re

_INLINE_WS = re.compile(r"[ \t]+")
_EXTRA_NEWLINES = re.compile(r"\n{3,}")


def normalize_text(raw: str) -> str:
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines = (_INLINE_WS.sub(" ", line).strip(" ") for line in text.split("\n"))
    return _EXTRA_NEWLINES.sub("\n\n", "\n".join(lines)).strip()
