from app.models import UserProfile


def test_get_profile_returns_default_user(client):
    response = client.get("/api/v1/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Default User"
    assert body["target_role"] == "Java Backend Developer"
    assert body["english_target"] == "IELTS 7.0"
    assert body["cv_text"] is None
    assert body["has_cv"] is False


def test_get_profile_404_when_no_rows(client, db_session):
    db_session.query(UserProfile).delete()
    db_session.commit()

    response = client.get("/api/v1/profile")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROFILE_NOT_FOUND"


def test_put_profile_updates_all_fields_and_persists(client):
    payload = {"full_name": "Nguyễn Văn A", "target_role": "Python Backend Intern", "english_target": "IELTS 6.5"}

    response = client.put("/api/v1/profile", json=payload)

    assert response.status_code == 200
    assert client.get("/api/v1/profile").json() == response.json()
    assert response.json()["target_role"] == "Python Backend Intern"
    assert response.json()["full_name"] == "Nguyễn Văn A"


def test_put_profile_partial_update_changes_only_given_field(client):
    response = client.put("/api/v1/profile", json={"english_target": "IELTS 6.5"})

    body = response.json()
    assert body["english_target"] == "IELTS 6.5"
    assert body["target_role"] == "Java Backend Developer"
    assert body["full_name"] == "Default User"


def test_put_profile_empty_body_is_noop(client):
    before = client.get("/api/v1/profile").json()

    response = client.put("/api/v1/profile", json={})

    assert response.status_code == 200
    assert response.json() == before


def test_put_profile_blank_target_role_rejected_and_unchanged(client):
    response = client.put("/api/v1/profile", json={"target_role": "   "})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert client.get("/api/v1/profile").json()["target_role"] == "Java Backend Developer"


def test_put_profile_null_target_role_rejected(client):
    response = client.put("/api/v1/profile", json={"target_role": None})

    assert response.status_code == 422


def test_put_profile_full_name_over_100_chars_rejected(client):
    assert client.put("/api/v1/profile", json={"full_name": "a" * 101}).status_code == 422


def test_put_profile_target_role_of_100_chars_accepted(client):
    assert client.put("/api/v1/profile", json={"target_role": "a" * 100}).status_code == 200
