"""Real browser navigation checks against the explicitly owned loopback fixture.

HTTP is used only to arrange fixture friendships/profile data. Authentication,
friend selection, invitation actions and route changes use the rendered UI.
Never records credentials, account identifiers, request bodies or socket payloads.
"""
import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
INTENT_KEY = "transcendence.online-intent.v1"
INSTRUMENT = r"""(() => {
  const activeFrames = new Set(), sockets = new Set(), sent = {};
  const fault = {dropGameEvents: []};
  const raf = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    let id = raf(time => { activeFrames.delete(id); callback(time); }); activeFrames.add(id); return id;
  };
  window.cancelAnimationFrame = id => { activeFrames.delete(id); return cancel(id); };
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = class extends OriginalWebSocket {
    constructor(...args) {
      super(...args); sockets.add(this); this.addEventListener('close', () => sockets.delete(this));
    }
    send(value) {
      if (typeof value === 'string') {
        const match = value.match(/^42\/game,\["([A-Za-z]+)"/);
        if (match) {
          sent[match[1]] = (sent[match[1]] || 0) + 1;
          if (fault.dropGameEvents.includes(match[1])) return;
        }
      }
      return super.send(value);
    }
  };
  window.__NAV_OBSERVATION__ = () => ({
    raf: activeFrames.size,
    sockets: [...sockets].filter(socket => socket.readyState < 2).length,
    sent: {...sent}, onlineDebug: Boolean(window.__ONLINE_DEBUG__), localDebug: Boolean(window.__ARCADE_DEBUG__)
  });
  window.__NAV_NETWORK_FAULT__ = fault;
})();"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base", help="Owned disposable fixture origin, e.g. http://127.0.0.1:59707")
    parser.add_argument("--phase", choices=("baseline", "after"), default="baseline")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or parsed.path:
        raise SystemExit("Only an explicitly owned 127.0.0.1 fixture origin is supported")
    out = Path(os.environ.get("ARCADE_EVIDENCE_DIR", ROOT / "docs/home-online-polish/evidence"))
    out.mkdir(parents=True, exist_ok=True)
    report = {"status": "FAIL", "phase": args.phase, "base": base,
              "viewport": {"width": 1440, "height": 900},
              "authentication": "Actual guest HTTP full redirect and existing cookie/router flow",
              "fixtureSetup": "Authenticated friendship HTTP only; no credentials or identities recorded",
              "checks": [], "limitations": ["Synthetic browser input; loopback fixture, not deployed service"]}
    checks = report["checks"]
    contexts = []
    errors = []
    requests = []
    start = time.monotonic()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get(
            "ARCADE_CHROMIUM_EXECUTABLE", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), headless=True)
        report["browser"] = browser.version

        def new_page():
            context = browser.new_context(viewport=report["viewport"])
            contexts.append(context)
            context.route("**/*", lambda route: route.continue_()
                          if route.request.url.startswith(base + "/") else route.abort())
            context.add_init_script(INSTRUMENT)
            page = context.new_page()
            page.set_default_timeout(12000)
            page.on("pageerror", lambda _error: errors.append("Uncaught browser error"))
            page.on("response", lambda response: requests.append({"path": re.sub(r"/\d+(?=/|$)", "/:fixture", urlparse(response.url).path), "status": response.status})
                    if urlparse(response.url).path.startswith(("/auth/", "/user/")) else None)
            return page

        def guest(page, destination="/login"):
            report["stage"] = "guest login page"
            page.goto(base + destination)
            report["stage"] = "guest login button"
            page.get_by_role("button", name="게스트로 체험하기", exact=True).click()
            report["stage"] = "guest callback"
            page.wait_for_function("!!localStorage.getItem('token')")
            page.wait_for_url(lambda url: urlparse(str(url)).path != "/login")

        def api(page, path, method="GET", data=None):
            # The token remains inside the browser and is never serialized to the driver.
            return page.evaluate("""async ({path,method,data}) => {
              const response = await fetch(path, {method, headers: {
                Authorization: 'Bearer ' + localStorage.getItem('token'),
                'Content-Type': 'application/json'
              }, ...(data ? {body:JSON.stringify(data)} : {})});
              const body = await response.text();
              let value; try { value = JSON.parse(body); } catch { value = null; }
              return {ok:response.ok,status:response.status,value};
            }""", {"path": path, "method": method, "data": data})

        try:
            left, right = new_page(), new_page()
            guest(left)
            guest(right)
            report["stage"] = "friendship arrangement"
            right_user = api(right, "/user/me")["value"]
            assert api(left, "/user/friends", "PATCH", {"id": right_user["id"]})["ok"]
            # Keep screenshots anonymous while retaining actual authenticated fixture users.
            nick = "상대" + str(int(time.time() * 1000))[-6:]
            assert api(right, "/user/nickname", "PATCH", {"nickname": nick})["ok"]
            right.goto(base + "/invite?debug=1")
            right.get_by_test_id("online-play").wait_for()
            left.goto(base + "/game?debug=1")
            left.get_by_test_id("online-play").wait_for()
            report["stage"] = "friend drawer selection"
            if args.phase == "baseline":
                left.locator(".sidebar-icon").filter(has_text=re.compile("^friends$")).click()
                left.get_by_text(nick, exact=True).wait_for()
                left.locator(".user-wrap").filter(has_text=nick).get_by_text("pong", exact=True).click()
            else:
                left.get_by_role("button", name="친구 목록 열기", exact=True).click()
                left.get_by_role("button", name=nick + " 초대하기", exact=True).click()
            left.wait_for_url(lambda url: urlparse(str(url)).path == "/invite")
            left.get_by_test_id("online-play").wait_for()
            target_label = left.get_by_test_id("online-play").inner_text()
            assert nick in target_label, "The selected friend must reach the real invitation view"
            left.get_by_test_id("online-play").click()
            report["stage"] = "invitation receiver refusal"
            right.get_by_test_id("online-play").click()
            right.get_by_text("Refuse", exact=True).wait_for()
            right.get_by_text("Refuse", exact=True).click()
            left.get_by_text("친구가 초대를 거절했습니다.", exact=True).first.wait_for()
            checks.append({"name": "H08 actual drawer friend selection → invite target → receiver refusal", "status": "PASS"})
            left.screenshot(path=str(out / (args.phase + "-friend-invite.png")), full_page=True)
            left.get_by_test_id("online-play").click()
            report["stage"] = "invitation receiver acceptance"
            right.get_by_test_id("online-play").click()
            right.get_by_text("Join", exact=True).wait_for()
            right.get_by_text("Join", exact=True).click()
            for page in (left, right):
                page.get_by_test_id("online-court").wait_for()
                page.wait_for_function("['ready','rally','point'].includes(document.querySelector('.online-game')?.dataset.phase)")
            checks.append({"name": "Actual receiver acceptance starts both invitation courts", "status": "PASS"})
            # UI SPA links exercise wrapper replacements and unmount ownership.
            report["stage"] = "spectator route ownership"
            if args.phase == "after":
                left.get_by_role("link", name="경기 관전", exact=True).click(no_wait_after=True)
            else:
                left.locator('a[href="/tempwatchpage"]').click(no_wait_after=True)
            left.wait_for_url(lambda url: urlparse(str(url)).path == "/spectate")
            left.get_by_test_id("online-play").wait_for()
            time.sleep(.5)
            observation = left.evaluate("window.__NAV_OBSERVATION__()")
            checks.append({"name": "Invite → spectator via existing service navigation", "status": "OBSERVED", "resources": observation,
                           "startEnabled": left.get_by_test_id("online-play").is_enabled()})
            if args.phase == "after":
                assert observation["raf"] == 0 and observation["sockets"] == 1
                assert left.get_by_test_id("online-play").is_enabled()
                report["stage"] = "spectator list empty and lost request"
                # Our invitation opponent has received the deliberate departure outcome.
                right.get_by_test_id("online-result").wait_for()
                left.get_by_test_id("online-play").click()
                left.get_by_test_id("spectator-empty").wait_for()
                left.keyboard.press("Escape")
                left.get_by_test_id("spectator-empty").wait_for(state="hidden")
                # Browser transport fault only: discard a roomlist request before send.
                left.evaluate("window.__NAV_NETWORK_FAULT__.dropGameEvents = ['roomlist']")
                left.get_by_test_id("online-play").click()
                left.get_by_test_id("spectator-loading").wait_for()
                left.get_by_test_id("spectator-list-error").wait_for(timeout=7000)
                assert not left.get_by_test_id("spectator-empty").is_visible()
                left.evaluate("window.__NAV_NETWORK_FAULT__.dropGameEvents = []")
                left.get_by_role("button", name="다시 시도", exact=True).click()
                left.get_by_test_id("spectator-empty").wait_for()
                left.get_by_role("button", name="경기 목록 닫기", exact=True).click()
                checks.append({"name": "Spectator real empty response differs from withheld-request timeout; retry recovers", "status": "PASS"})
                report["stage"] = "online Home back forward lifetime"
                before_end = left.evaluate("window.__NAV_OBSERVATION__().sent.end || 0")
                left.get_by_test_id("online-menu").click()
                left.wait_for_url(lambda url: urlparse(str(url)).path == "/")
                left.wait_for_function("window.__NAV_OBSERVATION__().sockets === 0 && window.__NAV_OBSERVATION__().raf === 0")
                assert left.evaluate("window.__NAV_OBSERVATION__().sent.end || 0") == before_end + 1
                for _ in range(2):
                    left.get_by_test_id("play-online").click()
                    left.wait_for_url("**/game")
                    left.get_by_test_id("online-play").wait_for()
                    left.wait_for_function("window.__NAV_OBSERVATION__().sockets === 1")
                    left.go_back()
                    left.wait_for_url(lambda url: urlparse(str(url)).path == "/")
                    left.wait_for_function("window.__NAV_OBSERVATION__().sockets === 0 && window.__NAV_OBSERVATION__().raf === 0")
                    left.go_forward()
                    left.wait_for_url("**/game")
                    left.wait_for_function("window.__NAV_OBSERVATION__().sockets === 1")
                    left.get_by_test_id("online-menu").click()
                    left.wait_for_url(lambda url: urlparse(str(url)).path == "/")
                    left.wait_for_function("window.__NAV_OBSERVATION__().sockets === 0 && window.__NAV_OBSERVATION__().raf === 0")
                checks.append({"name": "Home ↔ online via links, back/forward twice; one socket, idle RAF zero, one leave event", "status": "PASS"})
            report["status"] = "PASS"
        except Exception as error:
            # Assertion messages are authored here; browser exceptions can include DOM identities.
            report["failure"] = str(error) if isinstance(error, AssertionError) else str(error).splitlines()[0]
            report["httpChecks"] = requests[-15:]
            report["finalPaths"] = [urlparse(page.url).path for context in contexts for page in context.pages]
            if report.get("stage") == "spectator route ownership":
                report["failureDetail"] = str(error)
                report["bodyExcerpt"] = left.locator("body").inner_text()[:1500]
                left.screenshot(path=str(out / (args.phase + "-spectator-navigation-failure.png")), full_page=True)
        finally:
            report["pageErrors"] = errors
            report["elapsedSeconds"] = round(time.monotonic() - start, 3)
            for context in contexts:
                context.close()
            browser.close()
            (out / (args.phase + "-navigation-browser.json")).write_text(
                json.dumps(report, ensure_ascii=False, indent=2))
            (out / (args.phase + "-navigation-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json")).write_text(
                json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()
