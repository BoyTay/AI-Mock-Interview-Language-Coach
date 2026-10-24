import fitz


def make_pdf(pages: list[str]) -> bytes:
    doc = fitz.open()
    for text in pages:
        doc.new_page().insert_text((72, 72), text)
    return doc.tobytes()


def make_blank_pdf() -> bytes:
    """A page with no text layer, like a scanned CV."""
    doc = fitz.open()
    doc.new_page()
    return doc.tobytes()


def make_encrypted_pdf(text: str) -> bytes:
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), text)
    return doc.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="secret")
