"""Focused contract tests for private resume-review input validation."""


def test_submission_profile_keeps_portfolio_and_github_separate(app):
    with app.app_context():
        from app.routes.resume_review import _submission_profile
        profile, error = _submission_profile({"recruiter_profile": {
            "portfolio_url": "https://example.com/me",
            "github_url": "https://github.com/example",
            "linkedin_url": "https://www.linkedin.com/in/example",
        }})
    assert error is None
    assert profile["portfolio_url"] == "https://example.com/me"
    assert profile["github_url"] == "https://github.com/example"


def test_submission_profile_rejects_invalid_github_url(app):
    with app.app_context():
        from app.routes.resume_review import _submission_profile
        profile, error = _submission_profile({"recruiter_profile": {"github_url": "github.com/example"}})
    assert profile is None
    assert error == "GitHub link must be a valid web address starting with http:// or https://."
