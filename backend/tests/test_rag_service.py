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


def _hit(id_, category, score=0.0):
    return rag_service.RetrievedQuestion(
        id=id_,
        category=category,
        difficulty="MID",
        question_text=f"q{id_}",
        reference_answer="a",
        distance=1 - score,
        keyword_score=0.0,
        score=score,
    )


def _ids(hits):
    return [h.id for h in hits]


def test_diversify_skips_a_third_question_of_a_category_in_favour_of_other_categories():
    ranked = [_hit(1, "JAVA"), _hit(2, "JAVA"), _hit(3, "JAVA"), _hit(4, "SQL"), _hit(5, "OOP"), _hit(6, "JAVA")]

    picked = rag_service.diversify(ranked, limit=4, max_per_category=2)

    assert _ids(picked) == [1, 2, 4, 5]


def test_diversify_relaxes_the_cap_when_there_are_too_few_categories():
    ranked = [_hit(n, "JAVA") for n in range(1, 8)]

    picked = rag_service.diversify(ranked, limit=5, max_per_category=2)

    assert _ids(picked) == [1, 2, 3, 4, 5]


def test_diversify_returns_everything_when_fewer_than_the_limit():
    ranked = [_hit(1, "JAVA"), _hit(2, "SQL")]

    assert _ids(rag_service.diversify(ranked, limit=5, max_per_category=2)) == [1, 2]


def test_diversify_keeps_the_ranking_order_in_the_result():
    ranked = [_hit(1, "JAVA"), _hit(2, "JAVA"), _hit(3, "JAVA"), _hit(4, "SQL")]

    picked = rag_service.diversify(ranked, limit=4, max_per_category=2)

    assert _ids(picked) == [1, 2, 3, 4]
