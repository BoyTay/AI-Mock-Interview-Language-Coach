from app.services import rag_service


def test_query_combines_role_job_description_and_cv_summary():
    query = rag_service.build_query(
        target_role="Java Backend Developer",
        job_description="Build REST APIs with Spring Boot.",
        cv_text="Worked on payment services at Acme.",
    )

    assert "Java Backend Developer" in query
    assert "Build REST APIs with Spring Boot." in query
    assert "Worked on payment services at Acme." in query


def test_query_skips_missing_job_description_and_cv():
    query = rag_service.build_query("React Developer", None, None)

    assert query.strip() == "Target role: React Developer"


def test_query_summarises_a_long_cv_and_job_description_by_truncating():
    query = rag_service.build_query(
        "Dev", "x" * 5000, "z" * 5000
    )

    assert query.count("x") == rag_service.MAX_JD_CHARS
    assert query.count("z") == rag_service.MAX_CV_CHARS


def test_query_collapses_whitespace_from_pdf_extraction():
    query = rag_service.build_query("Dev", None, "Line one\n\n   Line   two")

    assert "Line one Line two" in query


def test_keywords_drop_stopwords_short_words_and_duplicates():
    words = rag_service.extract_keywords("We need a Java developer with Java and SQL experience in a team")

    assert words == ["java", "sql"]


def test_keywords_are_most_frequent_first_then_in_order_of_appearance():
    words = rag_service.extract_keywords("spring docker spring kafka docker spring")

    assert words == ["spring", "docker", "kafka"]


def test_keywords_contain_only_characters_that_are_safe_in_a_tsquery():
    words = rag_service.extract_keywords("C++ & Node.js | REST-API (v2) 'quoted' a:b")

    assert all(w.isalnum() and w.isascii() for w in words)
    assert {"node", "rest", "api", "quoted"} <= set(words)


def test_keywords_are_capped():
    text = " ".join(f"word{n}" for n in range(100))

    assert len(rag_service.extract_keywords(text)) == rag_service.MAX_KEYWORDS
