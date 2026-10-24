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
