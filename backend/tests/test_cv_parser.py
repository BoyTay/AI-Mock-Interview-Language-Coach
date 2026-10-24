import pytest

from app.services import cv_parser
from app.services.cv_parser import CvParseError, extract_text, normalize_text
from tests.pdf_factory import make_blank_pdf, make_encrypted_pdf, make_pdf

CV_PAGE = "Nguyen Van A - Java Backend Developer"


def test_collapses_inner_whitespace():
    assert normalize_text("a  b\t\tc") == "a b c"


def test_strips_trailing_whitespace_per_line():
    assert normalize_text("x \ny\t\n") == "x\ny"


def test_normalises_line_endings():
    assert normalize_text("a\r\nb\rc") == "a\nb\nc"


def test_collapses_three_or_more_newlines_to_two():
    assert normalize_text("a\n\n\n\n\nb") == "a\n\nb"


def test_strips_whole_text():
    assert normalize_text("  \n hello \n  ") == "hello"


def test_empty_stays_empty():
    assert normalize_text("") == ""


def test_keeps_vietnamese_diacritics():
    assert normalize_text("Nguyễn  Văn A") == "Nguyễn Văn A"


def test_extract_text_reads_every_page():
    data = make_pdf(["Nguyen Van A Java Developer", "Spring Boot, PostgreSQL"])

    text = extract_text(data)

    assert "Nguyen Van A Java Developer" in text
    assert "Spring Boot, PostgreSQL" in text


def test_extract_text_blank_pdf_is_no_text_layer():
    with pytest.raises(CvParseError) as exc:
        extract_text(make_blank_pdf())

    assert exc.value.code == "CV_NO_TEXT_LAYER"


def test_extract_text_too_short_is_no_text_layer():
    with pytest.raises(CvParseError) as exc:
        extract_text(make_pdf(["short"]))

    assert exc.value.code == "CV_NO_TEXT_LAYER"


def test_extract_text_garbage_is_unreadable():
    with pytest.raises(CvParseError) as exc:
        extract_text(b"not a pdf")

    assert exc.value.code == "CV_UNREADABLE"


def test_extract_text_encrypted_is_unreadable():
    with pytest.raises(CvParseError) as exc:
        extract_text(make_encrypted_pdf("Nguyen Van A Java Developer"))

    assert exc.value.code == "CV_UNREADABLE"


def test_extract_text_falls_back_to_pdfplumber_when_pymupdf_fails(monkeypatch):
    def boom(data):
        raise RuntimeError("pymupdf failed")

    monkeypatch.setattr(cv_parser, "_extract_pymupdf", boom)

    text = extract_text(make_pdf(["Nguyen Van A Java Developer"]))

    assert "Nguyen Van A Java Developer" in text


def test_normalize_text_drops_null_and_control_characters():
    assert normalize_text("Dev\x00eloper\x07 ok\tfine\nnext") == "Developer ok fine\nnext"


def test_extract_text_rejects_more_than_max_pages():
    data = make_pdf([CV_PAGE] * (cv_parser.MAX_PAGES + 1))

    with pytest.raises(CvParseError) as exc:
        extract_text(data)

    assert exc.value.code == "CV_TOO_LONG"


def test_extract_text_accepts_exactly_max_pages():
    assert extract_text(make_pdf([CV_PAGE] * cv_parser.MAX_PAGES))


def test_extract_text_rejects_text_over_max_chars(monkeypatch):
    monkeypatch.setattr(cv_parser, "_extract_pymupdf", lambda data: "a" * (cv_parser.MAX_CHARS + 1))

    with pytest.raises(CvParseError) as exc:
        extract_text(b"%PDF-")

    assert exc.value.code == "CV_TOO_LONG"
