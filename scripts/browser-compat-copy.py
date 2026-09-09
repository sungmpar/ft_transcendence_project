"""Capture current copy and actual guest transport in an owned loopback fixture.
No production URL, credential serialization, state/score mock or LNA claim.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("base")
parser.add_argument("--phase", choices=["before", "after"], required=True)
args = parser.parse_args()
base = args.base.rstrip("/")
u = urlsplit(base)
if u.scheme != "http" or u.hostname not in ["127.0.0.1", "localhost", "::1"] or u.username or u.password:
    raise SystemExit("Only an owned loopback fixture is supported")
out = Path(os.environ.get("ARCADE_EVIDENCE_DIR", "docs/compatibility-lna-copy/evidence"))
out.mkdir(parents=True, exist_ok=True)
dist = Path(os.environ.get("ARCADE_SCREEN_DIST", "frontend/dist"))
report = {
    "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "phase": args.phase, "status": "FAIL", "base": base,
    "fixture": "Actual guest account in a disposable PostgreSQL schema; fixed review nickname",
    "limits": "Automated Chrome application test; no native browser permission UI or public-to-private LNA verification",
    "screens": [], "requests": [], "webSockets": [], "checks": [], "pageErrors": [],
    "indexSha256": hashlib.sha256((dist / "index.html").read_bytes()).hexdigest(),
}
def clean_url(value):
    value = urlsplit(value)
    netloc = value.hostname or ""
    if value.port: netloc += ":" + str(value.port)
    query = [(k, v if k in ["EIO", "transport"] or (k == "token" and v == "check") else "[redacted]")
             for k, v in parse_qsl(value.query, keep_blank_values=True)]
    path = value.path
    if path.startswith("/user/image/"): path = "/user/image/[fixture-user]"
    return urlunsplit((value.scheme, netloc, path, urlencode(query), ""))
def check(name, passed, detail=None):
    report["checks"].append({"name": name, "pass": bool(passed), "detail": detail})
    assert passed, name
def capture(page, label):
    for w, h in [(1440, 900), (1366, 768), (390, 844)]:
        page.set_viewport_size({"width": w, "height": h})
        page.evaluate("document.fonts.ready")
        name = f"{args.phase}-{label}-{w}x{h}.png"
        page.screenshot(path=str(out / name), full_page=True)
        report["screens"].append({
            "file": name, "viewport": [w, h],
            "documentWidth": page.evaluate("document.documentElement.scrollWidth"),
            "text": page.locator("body").inner_text(),
        })
        if args.phase == "after":
            check(f"{label} {w} has no horizontal overflow",
                  page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            if label in ["home", "play-hub"] and w >= 1366:
                for mode in ["local", "ai", "online"]:
                    box = page.get_by_test_id("play-" + mode).bounding_box()
                    check(f"{label} {w} {mode} start button stays in first viewport",
                          box is not None and box["y"] + box["height"] <= h)
    page.set_viewport_size({"width": 1440, "height": 900})

def review_project_info(page, label):
    if args.phase != "after":
        return
    page.wait_for_load_state("networkidle")
    project = page.get_by_test_id("project-info")
    check(label + " has one shared project introduction", project.count() == 1)
    details = project.locator("details")
    summary = details.locator("summary")
    check(label + " starts with collapsed details", not details.evaluate("el => el.open"))
    visible = project.inner_text()
    check(label + " key technologies visible outside collapsed details",
          all(term in visible for term in ["Vue 3", "TypeScript", "Canvas 2D", "NestJS", "Socket.IO", "PostgreSQL"]))
    before = (len(report["requests"]), len(report["webSockets"]))
    summary.focus()
    page.keyboard.press("Shift+Tab")
    page.keyboard.press("Tab")
    check(label + " Tab reaches introduction with visible focus",
          summary.evaluate("el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'"))
    page.keyboard.press("Enter")
    check(label + " Enter opens native details", details.evaluate("el => el.open"))
    for w, h in [(1440, 900), (390, 844)]:
        page.set_viewport_size({"width": w, "height": h})
        check(f"{label} expanded introduction {w} fits",
              page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        page.screenshot(path=str(out / f"after-{label}-details-{w}x{h}.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 900})
    page.evaluate("document.documentElement.style.zoom = '2'")
    check(label + " expanded introduction at CSS 200% fits",
          page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    page.screenshot(path=str(out / f"after-{label}-details-css-200percent.png"), full_page=True)
    page.evaluate("document.documentElement.style.zoom = ''")
    summary.focus()
    page.keyboard.press("Space")
    check(label + " Space closes native details", not details.evaluate("el => el.open"))
    check(label + " introduction adds no HTTP or WebSocket requests",
          before == (len(report["requests"]), len(report["webSockets"])))
    page.evaluate("window.scrollTo(0, 0)")
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("ARCADE_CHROMIUM_EXECUTABLE", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        headless=True,
    )
    report["browser"] = browser.version
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base + "/") else r.abort())
    context.on("request", lambda r: report["requests"].append({
        "url": clean_url(r.url), "kind": r.resource_type, "method": r.method,
        "navigation": r.is_navigation_request(),
    }))
    page = context.new_page()
    page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
    page.on("websocket", lambda socket: report["webSockets"].append(clean_url(socket.url)))
    try:
        page.goto(base + "/login")
        page.get_by_test_id("guest-login").wait_for()
        capture(page, "login")
        review_project_info(page, "login")
        page.goto(base + "/play")
        page.get_by_test_id("play-hub").wait_for()
        capture(page, "play-hub")
        review_project_info(page, "play-hub")
        page.get_by_test_id("play-online").click()
        page.get_by_test_id("guest-login").click()
        page.wait_for_url("**/game")
        page.get_by_test_id("online-play").wait_for()
        guests = [r for r in report["requests"] if urlsplit(r["url"]).path == "/auth/guest"]
        check("One actual guest request", len(guests) == 1, guests)
        report["guestTransport"] = guests[0]["kind"]
        if args.phase == "after":
            check("Guest request is a document navigation, never fetch",
                  guests[0]["kind"] == "document" and guests[0]["navigation"])
        check("Actual guest cookie callback reaches intended game lobby", "/game" in page.url)
        page.goto(base + "/")
        page.get_by_test_id("home").wait_for()
        status = page.evaluate("""async()=> (await fetch('/user/nickname', {
            method:'PATCH', headers:{'Content-Type':'application/json',
            Authorization:'Bearer '+localStorage.getItem('token')},
            body:JSON.stringify({nickname:'검토플레이어'})})).status""")
        check("Fixture nickname prepared through actual existing API", status == 200, {"httpStatus": status})
        page.reload()
        page.get_by_test_id("home").wait_for()
        capture(page, "home")
        review_project_info(page, "home")
        page.get_by_test_id("play-online").click()
        page.get_by_test_id("online-play").wait_for()
        capture(page, "online-lobby")
        if args.phase == "after":
            page.locator(".online-diagnostics summary").click()
            check("Online details explain occurrence counts and input confirmation",
                  all(term in page.locator(".online-diagnostics").inner_text()
                      for term in ["입력 반영 확인 시간", "추정 표시 지연", "매 프레임을 세지 않습니다"]))
            page.screenshot(path=str(out / "after-online-diagnostics-1440x900.png"), full_page=True)
            page.get_by_test_id("online-key-layout").select_option("wasd")
            check("Online selected keys have explicit roles",
                  page.get_by_test_id("online-key-hint").inner_text() == "위로 W · 아래로 S · Power D")
            check("Static build makes no HMR connection",
                  not any(urlsplit(value).path == "/ws" for value in report["webSockets"]))
        check("No automatic matching from navigation", page.get_by_test_id("online-play").inner_text() == "상대 찾기")
        if args.phase == "after":
            page.goto(base + "/play/local?rule=power")
            page.get_by_test_id("key-settings").click()
            for action, code in [("up", "KeyI"), ("down", "KeyK"), ("action", "KeyL")]:
                page.get_by_test_id("binding-left-" + action).select_option(code)
            page.get_by_test_id("apply-bindings").click()
            check("Local copy follows remapped keys",
                  page.get_by_test_id("local-left-key-hint").inner_text() == "위로 I · 아래로 K · Power L")
            for path, label in [("/play", "Public hub"), ("/", "Home")]:
                page.goto(base + path)
                page.get_by_test_id("hub-human-keys").wait_for()
                option = page.get_by_test_id("hub-human-keys").locator("option[value=left]")
                check(label + " shows saved key roles",
                      option.inner_text() == "위로 I · 아래로 K · Power L")
                check(label + " shows matching local paddle bindings",
                      page.locator(".launch-local kbd").all_text_contents() == ["I", "K", "L", "↑", "↓", "←"])
            page.get_by_test_id("hub-human-keys").select_option("left")
            page.get_by_test_id("play-ai").click()
            check("AI chosen keys control the described human left paddle",
                  page.get_by_test_id("local-left-key-hint").inner_text() == "위로 I · 아래로 K · Power L" and
                  "컴퓨터가 오른쪽 패들을 조작합니다." in page.get_by_test_id("local-right-key-hint").inner_text())
            page.screenshot(path=str(out / "after-ai-remapped-key-copy-1440x900.png"), full_page=True)
        check("No page errors", not report["pageErrors"])
        report["status"] = "CAPTURED"
    finally:
        context.close()
        browser.close()
        (out / f"{args.phase}-copy-browser.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({k: v for k, v in report.items() if k not in ["requests", "screens"]}, ensure_ascii=False))
