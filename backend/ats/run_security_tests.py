"""
Runs every fixture through the real pipeline and checks the outcome against what we EXPECT.

    python make_fixtures.py
    python run_security_tests.py              # mocked LLM, no ClamAV needed (tests everything except AV + model behaviour)
    python run_security_tests.py --with-av    # also test the ClamAV fixture (needs clamd running)
    python run_security_tests.py --live       # use your real Ollama model (tests how the MODEL reacts to injections)

Exit code is 1 if any expectation fails, so you can run this in CI on every change.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[0] = str(HERE.parent)  # put backend/ (not ats/) on the path so `import ats` is the package

ap = argparse.ArgumentParser()
ap.add_argument("--live", action="store_true", help="call the real Ollama model instead of a mock")
ap.add_argument("--with-av", action="store_true", help="require ClamAV (fixture 27 must be caught)")
args = ap.parse_args()
os.environ["REQUIRE_ANTIVIRUS"] = "1" if args.with_av else "0"

from ats import pipeline  # noqa: E402
from ats.schemas import LLMReview  # noqa: E402
from ats.security import UploadRejected, clamav_scan  # noqa: E402

JD = ("Backend Intern. Required: Python, SQL, REST APIs, Docker. "
      "Preferred: AWS, Kubernetes, CI/CD, Flask.")

if not args.live:
    EMPTY = {
        "summary": "mock", "overall_fit": "moderate", "fit_rationale": "mock",
        "ats_parsed": {"education": [], "experience": [], "projects": [], "skills": [], "certifications": []},
        "jd_requirements": [], "strengths": [], "suggestions": [], "suspected_prompt_injection": False,
    }
    pipeline.call_ollama = lambda messages, retries=2: LLMReview.model_validate(EMPTY)

# kind: ("pass",) | ("reject", [acceptable message fragments]) | ("flag", {required flags}) | ("av",) | ("gap",)
EXPECT = {
    "00_clean_control.pdf": ("pass",),
    "00_clean_control.docx": ("pass",),
    "01_pdf_javascript_openaction.pdf": ("reject", ["scripts, actions"]),
    "02_pdf_embedded_file.pdf": ("reject", ["attached files", "scripts, actions"]),
    "03_pdf_launch_action.pdf": ("reject", ["launch other files", "scripts, actions"]),
    "04_pdf_encrypted.pdf": ("reject", ["Password-protected"]),
    "05_pdf_too_many_pages.pdf": ("reject", ["limited to"]),
    "06_fake_magic_bytes.pdf": ("reject", ["valid PDF"]),
    "07_oversize.pdf": ("reject", ["too large"]),
    "08_docx_macro.docx": ("reject", ["macros"]),
    "09_docx_zip_bomb.docx": ("reject", ["unsafe size"]),
    "10_docx_remote_template.docx": ("reject", ["external templates"]),
    "11_docx_embedded_object.docx": ("reject", ["macros or embedded objects"]),
    "12_wrong_extension.pdf.exe": ("reject", ["Only PDF and DOCX"]),
    "20_pdf_hidden_white_text_injection.pdf": ("flag", {"hidden_text_removed"}),
    "21_pdf_tiny_text_injection.pdf": ("flag", {"hidden_text_removed"}),
    "22_pdf_visible_injection.pdf": ("flag", {"resume_injection_phrase:ignore_previous",
                                              "resume_injection_phrase:recommend_candidate"}),
    "23_docx_hidden_white_text.docx": ("flag", {"hidden_text_removed"}),
    "29_pdf_off_page_text_injection.pdf": ("flag", {"hidden_text_removed"}),
    "24_docx_unicode_tag_smuggling.docx": ("flag", {"unicode_tag_smuggling"}),
    "25_docx_visible_injection.docx": ("flag", {"resume_injection_phrase:ignore_previous"}),
    "26_pdf_scanned_no_text.pdf": ("reject", ["readable text"]),
    "27_eicar_av_test.com": ("av",),
    "28_pdf_paraphrased_injection_evades_regex.pdf": ("gap", "regex list can't catch paraphrases; relies on schema + verification + model flag"),
    "30_pdf_known_gap_text_under_rectangle.pdf": ("gap", "text covered by a white box is still extracted; needs render-and-OCR comparison"),
}

GREEN, RED, YELLOW, DIM, END = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
failures = 0


def run(name: str):
    p = HERE / "fixtures" / name
    if not p.exists():
        return "missing", "run make_fixtures.py first", None
    try:
        r = pipeline.process_resume(name, p.read_bytes(), JD)
        return "processed", r["security"], r
    except UploadRejected as e:
        return "rejected", str(e), None


print(f"{'FIXTURE':<44} {'EXPECTED':<10} RESULT")
print("-" * 100)
for name, exp in EXPECT.items():
    kind = exp[0]
    status, info, report = run(name)
    ok, note = False, ""

    if status == "missing":
        print(f"{name:<44} {'-':<10} {RED}MISSING (run make_fixtures.py){END}")
        failures += 1
        continue

    if kind == "pass":
        ok = status == "processed" and info["sponsor_submission_allowed"] and not info["flags"]
        note = "clean, sponsor-eligible" if ok else f"{status}: {info}"
    elif kind == "reject":
        ok = status == "rejected" and any(f in info for f in exp[1])
        note = info[:60] if status == "rejected" else "NOT REJECTED"
    elif kind == "flag":
        flags = set(info["flags"]) if status == "processed" else set()
        ok = status == "processed" and exp[1] <= flags and not info["sponsor_submission_allowed"]
        note = f"flags={sorted(flags)} sponsor_allowed={info['sponsor_submission_allowed']}" if status == "processed" else info
    elif kind == "av":
        if not args.with_av:
            print(f"{name:<44} {'av':<10} {YELLOW}SKIPPED{END} {DIM}(needs clamd; rerun with --with-av){END}")
            continue
        try:  # scan the raw file directly: see the note on fixture 27 in make_fixtures.py
            clamav_scan((HERE / "fixtures" / name).read_bytes())
            ok, note = False, "NOT DETECTED"
        except UploadRejected as e:
            ok, note = "virus scanner" in str(e), str(e)[:60]
    elif kind == "gap":
        caught = status == "processed" and bool(info["flags"])
        print(f"{name:<44} {'gap':<10} "
              + (f"{GREEN}NOW DETECTED{END} flags={info['flags']}" if caught else
                 f"{YELLOW}KNOWN GAP{END} {DIM}{exp[1]}{END}"))
        continue

    print(f"{name:<44} {kind:<10} " + (f"{GREEN}OK{END}   " if ok else f"{RED}FAIL{END} ") + f"{DIM}{note}{END}")
    failures += 0 if ok else 1

    if args.live and report and kind == "flag":
        fb = report["feedback"]
        print(f"{'':<55}{DIM}live model: injection_flagged={'model_suspected_injection' in report['security']['flags']}, "
              f"fit={fb['overall_fit']}{END}")

print("-" * 100)
print(f"{GREEN}All expectations met.{END}" if not failures else f"{RED}{failures} expectation(s) failed.{END}")
sys.exit(1 if failures else 0)