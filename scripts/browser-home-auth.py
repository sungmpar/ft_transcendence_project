"""Browser auth/intent regression on an owned loopback fixture, with real guest redirects.

Session intent mutations are test input. No authentication credential is injected,
returned, or printed. Fixture profile preparation uses the normal authenticated API.
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, quote

from playwright.sync_api import sync_playwright, expect
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
KEY = "transcendence.online-intent.v1"
sys.dont_write_bytecode = True
spec = spec_from_file_location("navigation_checks", ROOT / "scripts/browser-home-navigation.py")
navigation = module_from_spec(spec)
spec.loader.exec_module(navigation)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("--disabled-base")
    parser.add_argument("--only", help="Run checks whose names contain this text; recorded as a partial selection")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    origins = [base] + ([args.disabled_base.rstrip("/")] if args.disabled_base else [])
    if any(urlparse(origin).scheme != "http" or urlparse(origin).hostname != "127.0.0.1" or urlparse(origin).path for origin in origins):
        raise SystemExit("Only explicitly owned 127.0.0.1 origins are supported")
    out = Path(os.environ.get("ARCADE_EVIDENCE_DIR", ROOT / "docs/home-online-polish/evidence"))
    out.mkdir(parents=True, exist_ok=True)
    report = {"status": "FAIL", "base": base, "viewport": {"width": 1440, "height": 900},
              "authentication": "No authentication attempted in the selected guest-disabled check" if args.only == "Guest-disabled" else "Actual guest cookie and full document redirect; no credential injection",
              "disabledBase": args.disabled_base,
              "selection": args.only or "all",
              "checks": [], "limitations": ["No real 42 OAuth or external 2FA email/code executed", "Nickname-missing callback and truly expired signed JWT are not exercised by this browser fixture"]}
    start = time.monotonic()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("ARCADE_CHROMIUM_EXECUTABLE", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), headless=True)
        report["browser"] = browser.version

        def run(name, action, origin=base):
            if args.only and args.only not in name:
                return
            result = {"name": name, "status": "FAIL", "origin": origin}
            context = browser.new_context(viewport=report["viewport"])
            context.add_init_script(navigation.INSTRUMENT)
            unexpected = []
            def restrict(route):
                if route.request.url.startswith(origin + "/"):
                    route.continue_()
                else:
                    unexpected.append("External request blocked")
                    route.abort()
            context.route("**/*", restrict)
            page = context.new_page()
            page.set_default_timeout(10000)
            errors = []
            page.on("pageerror", lambda _error: errors.append("Uncaught browser error"))
            try:
                action(page, context, result)
                assert not errors, "Unexpected browser error"
                assert not unexpected, "Unexpected external request"
                result["status"] = "PASS"
            except Exception as error:
                result["failure"] = str(error).splitlines()[0]
                result["path"] = urlparse(page.url).path
            finally:
                context.close()
                report["checks"].append(result)
                print(json.dumps({"name": name, "status": result["status"]}, ensure_ascii=False), flush=True)

        def guest(page):
            page.get_by_role("button", name="게스트로 체험하기", exact=True).click()
            page.wait_for_function("!!localStorage.getItem('token')")
            page.wait_for_url(lambda url: urlparse(str(url)).path != "/login")

        def clean_intent(page):
            return page.evaluate("key => sessionStorage.getItem(key) === null", KEY)

        def assert_home(page):
            page.wait_for_url(lambda url: urlparse(str(url)).path == "/")
            page.get_by_test_id("play-ai").wait_for()
            assert clean_intent(page), "Consumed or invalid intent must be cleared"

        for target in ("/game", "/invite", "/spectate"):
            def valid(page, _context, result, target=target):
                page.goto(base + "/play")
                if target == "/game":
                    page.get_by_test_id("play-online").click()
                else:
                    # Direct protected entry is a real address-bar navigation.
                    page.goto(base + target)
                page.wait_for_url(lambda url: urlparse(str(url)).path == "/login")
                assert not page.evaluate("!!localStorage.getItem('token')")
                guest(page)
                page.wait_for_url(lambda url: urlparse(str(url)).path == target)
                page.get_by_test_id("online-play").wait_for()
                assert clean_intent(page)
                expect(page.get_by_test_id("online-play")).to_be_enabled()
                assert page.evaluate("window.__NAV_OBSERVATION__().sent.matchmaking || 0") == 0, "Login return must not auto-match"
                result["destination"] = target
            run("Real full guest redirect returns once to " + target, valid)

        for target in ("https://example.invalid/game", "//example.invalid", "javascript:alert(1)", "/login?token=check", "/game?target=unexpected"):
            def invalid(page, _context, _result, target=target):
                page.goto(base + "/login?next=" + quote(target, safe=""))
                assert clean_intent(page)
                guest(page)
                assert_home(page)
            run("Rejected login destination " + target.split(":")[0].split("?")[0], invalid)

        for kind in ("missing", "expired", "malformed"):
            def bad_storage(page, _context, _result, kind=kind):
                page.goto(base + "/login")
                if kind == "expired":
                    page.evaluate("key => sessionStorage.setItem(key,JSON.stringify({version:1,destination:'/game',createdAt:Date.now()-600001}))", KEY)
                elif kind == "malformed":
                    page.evaluate("key => sessionStorage.setItem(key,'{bad')", KEY)
                guest(page)
                assert_home(page)
            run("Full redirect with " + kind + " stored intent safely reaches Home", bad_storage)

        def cancelled(page, _context, _result):
            page.goto(base + "/login?next=/game")
            page.get_by_role("link", name="온라인 진입 취소 · 플레이 메뉴", exact=True).click()
            page.wait_for_url("**/play")
            assert clean_intent(page)
            assert not page.evaluate("!!localStorage.getItem('token')")
            page.get_by_test_id("play-ai").click()
            page.wait_for_url("**/play/ai*")
        run("Cancel clears login intent and keeps public AI entry usable", cancelled)

        for path in ("/play", "/play/local", "/play/ai"):
            def public(page, context, result, path=path):
                attempts = []
                def block_api(route):
                    attempts.append("Unexpected backend request")
                    route.fulfill(status=503, body="isolated backend unavailable")
                context.route(re.compile(r"/((user|auth)(/|$)|socket\.io)"), block_api)
                page.goto(base + path)
                page.get_by_test_id("play-ai" if path == "/play" else "court").wait_for()
                time.sleep(.2)
                assert not attempts, "Public route requested auth/backend"
                assert page.evaluate("window.__NAV_OBSERVATION__().sockets") == 0
                assert not page.evaluate("!!localStorage.getItem('token')")
                result["backendRequests"] = 0
                result["sockets"] = 0
            run("Fresh context backend blocked " + path, public)

        def prerequisite(page, _context, result):
            page.goto(base + "/login")
            guest(page)
            assert_home(page)
            status = page.evaluate("""async () => {
              const auth={Authorization:'Bearer '+localStorage.getItem('token'),'Content-Type':'application/json'};
              const setting=await fetch('/user/need2fa',{method:'PATCH',headers:auth,body:JSON.stringify({value:true})});
              const logout=await fetch('/auth/logout',{headers:auth});
              return [setting.status,logout.status];
            }""")
            assert status == [200, 200], "2FA fixture setup must use authorized real endpoints"
            page.goto(base + "/game")
            page.wait_for_url("**/tfa")
            assert page.evaluate("key => JSON.parse(sessionStorage.getItem(key)||'null')?.destination === '/game'", KEY)
            assert page.get_by_test_id("online-play").count() == 0
            assert page.evaluate("window.__NAV_OBSERVATION__().sockets") == 0
            result["emailSent"] = False
            result["destinationStillPending"] = True
        run("Required 2FA gate retains online intent without opening a game socket", prerequisite)

        def friends(page, context, _result):
            page.goto(base + "/login")
            guest(page)
            opener = page.get_by_role("button", name="친구 목록 열기", exact=True)
            opener.click()
            page.get_by_test_id("friends-empty").wait_for()
            page.keyboard.press("Escape")
            page.wait_for_function("document.activeElement?.getAttribute('aria-label') === '친구 목록 열기'")
            context.route("**/user/friends", lambda route: route.fulfill(status=503, body="isolated test failure"))
            opener.click()
            page.get_by_test_id("friends-error").wait_for()
            assert not page.get_by_test_id("friends-empty").is_visible()
            page.get_by_role("button", name="친구 목록 닫기", exact=True).click()
            page.wait_for_function("document.activeElement?.getAttribute('aria-label') === '친구 목록 열기'")
        run("Friend drawer distinguishes empty/error and restores keyboard focus", friends)

        def logout(page, context, _result):
            page.goto(base + "/login")
            guest(page)
            page.get_by_test_id("play-online").click()
            page.wait_for_url("**/game")
            page.get_by_test_id("online-play").wait_for()
            context.route("**/auth/logout", lambda route: route.fulfill(status=503, body="isolated test failure"))
            page.get_by_role("button", name="로그아웃", exact=True).click()
            page.wait_for_url("**/login?logout=unconfirmed")
            page.get_by_text("이 기기에서 로그아웃했습니다. 서버 로그아웃은 확인하지 못했습니다.", exact=True).wait_for()
            assert not page.evaluate("!!localStorage.getItem('token')")
            assert clean_intent(page)
            page.wait_for_function("window.__NAV_OBSERVATION__().sockets === 0 && window.__NAV_OBSERVATION__().raf === 0")
        run("Failed server logout truthfully reports local cleanup and releases sockets", logout)

        if args.disabled_base:
            def disabled(page, _context, _result):
                page.goto(args.disabled_base.rstrip("/") + "/login?next=/game")
                page.get_by_test_id("guest-disabled").wait_for()
                assert page.get_by_test_id("guest-login").count() == 0
                page.get_by_role("link", name="AI 대전 시작 →", exact=True).click()
                page.get_by_test_id("court").wait_for()
            run("Guest-disabled build retains public AI navigation", disabled, args.disabled_base.rstrip("/"))
        else:
            report["limitations"].append("Guest-disabled build not supplied to this invocation")
        browser.close()
    report["status"] = "PASS" if all(check["status"] == "PASS" for check in report["checks"]) else "FAIL"
    report["elapsedSeconds"] = round(time.monotonic() - start, 3)
    report["executedAt"] = datetime.now(timezone.utc).isoformat()
    encoded = json.dumps(report, ensure_ascii=False, indent=2)
    (out / ("auth-navigation-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json")).write_text(encoded)
    (out / ("after-auth-navigation-filtered.json" if args.only else "after-auth-navigation-browser.json")).write_text(encoded)
    print(json.dumps({"status": report["status"], "checks": len(report["checks"]), "elapsedSeconds": report["elapsedSeconds"]}))
    raise SystemExit(0 if report["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()
