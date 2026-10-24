from app.models import UserProfile
from tests.pdf_factory import make_blank_pdf, make_pdf

URL = "/api/v1/profile/upload-cv"
MAX_BYTES = 5 * 1024 * 1024
CV_LINE = "Nguyen Van A - Java Backend Developer - Spring Boot, PostgreSQL, Docker"


def upload(client, data: bytes, filename: str = "cv.pdf"):
    return client.post(URL, files={"file": (filename, data, "application/pdf")})


def stored_cv_text(db_session) -> str | None:
    db_session.expire_all()
    return db_session.query(UserProfile).one().cv_text


def test_upload_valid_pdf_stores_text_and_returns_preview(client, db_session):
    pages = [CV_LINE + f" #{i}" for i in range(12)]

    response = upload(client, make_pdf(pages))

    assert response.status_code == 200
    body = response.json()
    cv_text = stored_cv_text(db_session)
    assert "Spring Boot" in cv_text
    assert body["char_count"] == len(cv_text)
    assert len(cv_text) > 500
    assert body["preview"] == cv_text[:500]
    assert client.get("/api/v1/profile").json()["has_cv"] is True


def test_upload_non_pdf_extension_returns_415(client, db_session):
    response = upload(client, b"plain text", "notes.txt")

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
    assert stored_cv_text(db_session) is None


def test_upload_pdf_named_file_with_non_pdf_bytes_returns_415(client, db_session):
    response = upload(client, b"MZ\x90\x00 definitely an exe", "cv.pdf")

    assert response.status_code == 415
    assert stored_cv_text(db_session) is None


def test_upload_uppercase_extension_is_accepted(client):
    assert upload(client, make_pdf([CV_LINE]), "CV.PDF").status_code == 200


def test_upload_of_exactly_max_size_passes_size_check(client):
    data = b"%PDF-" + b"0" * (MAX_BYTES - 5)

    response = upload(client, data)

    assert response.status_code != 413  # it then fails parsing, which is a different error
    assert response.json()["error"]["code"] == "CV_UNREADABLE"


def test_upload_one_byte_over_max_returns_413(client, db_session):
    data = b"%PDF-" + b"0" * (MAX_BYTES - 4)

    response = upload(client, data)

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"
    assert stored_cv_text(db_session) is None


def test_upload_scanned_pdf_returns_422_and_keeps_existing_cv(client, db_session):
    assert upload(client, make_pdf([CV_LINE])).status_code == 200
    before = stored_cv_text(db_session)

    response = upload(client, make_blank_pdf())

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CV_NO_TEXT_LAYER"
    assert stored_cv_text(db_session) == before


def test_upload_without_file_field_returns_validation_error(client):
    response = client.post(URL)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_reupload_replaces_previous_text(client, db_session):
    upload(client, make_pdf(["First CV with enough characters in it"]))

    upload(client, make_pdf(["Second CV with enough characters in it"]))

    assert "Second CV" in stored_cv_text(db_session)
    assert "First CV" not in stored_cv_text(db_session)
