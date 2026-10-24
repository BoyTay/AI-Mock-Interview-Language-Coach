from app.services.cv_parser import normalize_text


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
