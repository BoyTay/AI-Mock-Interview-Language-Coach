import io
import re

import fitz  # PyMuPDF
import pdfplumber

MIN_TEXT_CHARS = 20

_INLINE_WS = re.compile(r"[ \t]+")
_EXTRA_NEWLINES = re.compile(r"\n{3,}")


class CvParseError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)




def _unreadable() -> CvParseError:
    return CvParseError(
        "CV_UNREADABLE",
        "Không đọc được file PDF (file hỏng hoặc có mật khẩu). Hãy thử xuất lại PDF không đặt mật khẩu.",
    )


def _no_text_layer() -> CvParseError:
    return CvParseError(
        "CV_NO_TEXT_LAYER",
        "PDF này không có lớp văn bản (có thể là ảnh quét). Hãy xuất PDF từ trình soạn thảo hoặc dán nội dung CV thủ công.",
    )


def normalize_text(raw: str) -> str:
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines = (_INLINE_WS.sub(" ", line).strip(" ") for line in text.split("\n"))
    return _EXTRA_NEWLINES.sub("\n\n", "\n".join(lines)).strip()


def _extract_pymupdf(data: bytes) -> str:
    with fitz.open(stream=data, filetype="pdf") as doc:
        if doc.needs_pass:
            raise _unreadable()
        return "\n".join(page.get_text() for page in doc)


def _extract_pdfplumber(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def extract_text(data: bytes) -> str:
    """Return normalised CV text, or raise CvParseError."""
    try:
        text = normalize_text(_extract_pymupdf(data))
    except CvParseError:
        raise
    except Exception:
        text = ""
        pymupdf_failed = True
    else:
        pymupdf_failed = False

    if not text:
        try:
            text = normalize_text(_extract_pdfplumber(data))
        except Exception:
            # Both parsers choked on the file; an empty PyMuPDF result alone means "scanned".
            if pymupdf_failed:
                raise _unreadable()
    if len(text) < MIN_TEXT_CHARS:
        raise _no_text_layer()
    return text
