"""Real HMR handshake through owned direct and reverse-proxy loopback origins.

Fresh default-security Chromium, no permissions granted, no authentication or
guest click. This verifies routing, not an operational LNA permission dialog.
"""
import argparse
import asyncio
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from playwright.async_api import async_playwright


def safe_url(value):
    parsed = urlsplit(value)
    return urlunsplit((parsed.scheme, parsed.hostname + (f":{parsed.port}" if parsed.port else ""), parsed.path, "[masked]" if parsed.query else "", ""))


def safe_message(value):
    value = re.sub(r"(?:https?|wss?)://[^\s\"'<>]+", lambda match: safe_url(match.group(0)), value)
    value = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[token masked]", value)
    value = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email masked]", value)
    return value[:2000]


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--connection-policy", choices=["initial", "eventual"], default="initial")
    args = parser.parse_args()
    metadata = json.loads((args.evidence / "fixture.json").read_text())
    output = args.output or args.evidence
    output.mkdir(parents=True, exist_ok=True)
    if (output / "browser-hmr.json").exists():
        raise ValueError("Use a new output directory; previous evidence must be preserved")
    report = {"status": "RUNNING", "fixture": metadata, "scope": "Owned HTTP loopback direct serve and reverse proxy, tokenless /login, no guest click, no permission grants", "connectionPolicy": args.connection_policy, "cases": []}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless=True)
        report["browserVersion"] = browser.version
        try:
            for label, origin in [("direct", metadata["directOrigin"]), ("proxy", metadata["proxyOrigin"])]:
                parsed = urlsplit(origin)
                assert parsed.scheme == "http" and parsed.hostname == "127.0.0.1" and not parsed.username
                context = await browser.new_context(viewport={"width": 1440, "height": 900})
                row = {"label": label, "origin": origin, "requests": [], "webSockets": [], "responseStatuses": [], "console": [], "pageErrors": [], "assetHashes": [], "status": "RUNNING"}
                report["cases"].append(row)
                asset_tasks = []
                try:
                    page = await context.new_page()
                    await page.add_init_script("""(() => {
                      window.__compatHmrTrace = [];
                      const Native = window.WebSocket;
                      window.WebSocket = new Proxy(Native, {construct(target, args, newTarget) {
                        const socket = Reflect.construct(target, args, newTarget);
                        const item = {opened: false, closed: false, createdAt: Date.now()};
                        window.__compatHmrTrace.push(item);
                        socket.addEventListener('open', () => { item.opened = true; item.openedAt = Date.now(); });
                        socket.addEventListener('close', event => {
                          item.closed = true; item.closeCode = event.code; item.wasClean = event.wasClean; item.closedAt = Date.now();
                        });
                        return socket;
                      }});
                    })();""")
                    page.on("console", lambda message: row["console"].append({"type": message.type, "text": safe_message(message.text)}) if message.type in ["warning", "error"] and len(row["console"]) < 20 else None)
                    page.on("pageerror", lambda error: row["pageErrors"].append(safe_message(str(error))) if len(row["pageErrors"]) < 10 else None)
                    async def asset_hash(response):
                        if response.request.resource_type == "script" and urlsplit(response.url).netloc == parsed.netloc:
                            row["assetHashes"].append({"url": safe_url(response.url), "status": response.status, "sha256": hashlib.sha256(await response.body()).hexdigest()})
                    page.on("response", lambda response: asset_tasks.append(asyncio.create_task(asset_hash(response))))
                    page.on("request", lambda request: row["requests"].append({"url": safe_url(request.url), "type": request.resource_type}))
                    client = await context.new_cdp_session(page)
                    await client.send("Network.enable")
                    client.on("Network.webSocketHandshakeResponseReceived", lambda event: row["responseStatuses"].append(event["response"]["status"]))
                    def capture(socket):
                        record = {"url": safe_url(socket.url), "messageTypes": [], "errors": 0, "closed": False}
                        row["webSockets"].append(record)
                        def frame(payload):
                            try:
                                value = json.loads(payload)
                                kind = value.get("type")
                                if kind in ["hot", "liveReload", "reconnect", "overlay", "hash", "ok", "warnings", "errors", "invalid", "still-ok"]:
                                    record["messageTypes"].append(kind)
                            except (ValueError, AttributeError, TypeError):
                                pass
                        socket.on("framereceived", frame)
                        socket.on("socketerror", lambda _error: record.__setitem__("errors", record["errors"] + 1))
                        socket.on("close", lambda: record.__setitem__("closed", True))
                    page.on("websocket", capture)
                    response = await page.goto(origin + "/login", wait_until="domcontentloaded")
                    assert response.status == 200
                    expected = origin.replace("http:", "ws:") + "/ws"
                    for _attempt in range(100):
                        if any(socket["url"] == expected and "hash" in socket["messageTypes"] and any(kind in socket["messageTypes"] for kind in ["ok", "warnings"]) for socket in row["webSockets"]):
                            break
                        await asyncio.sleep(0.1)
                    if args.connection_policy == "eventual":
                        # Retain initial-survival results separately. Exercise only
                        # the installed client's real automatic retry, without
                        # creating a socket, altering heartbeat or suppressing close.
                        await page.locator("#login-title").wait_for(state="visible")
                        stable_socket, stable_since = None, None
                        loop = asyncio.get_running_loop()
                        for _attempt in range(200):
                            alive = [item for item in row["webSockets"] if not item["closed"]]
                            current = alive[0] if len(alive) == 1 else None
                            if current is not None and current["url"] == expected and "hash" in current["messageTypes"] and any(kind in current["messageTypes"] for kind in ["ok", "warnings"]):
                                if current is not stable_socket:
                                    stable_socket, stable_since = current, loop.time()
                                if loop.time() - stable_since >= 3:
                                    break
                            else:
                                stable_socket, stable_since = None, None
                            await asyncio.sleep(0.1)
                        assert stable_socket is not None and not stable_socket["closed"] and loop.time() - stable_since >= 3, row["webSockets"]
                        socket = stable_socket
                        row["stableObservedSeconds"] = round(loop.time() - stable_since, 3)
                        row["initialConnectionSurvived"] = not row["webSockets"][0]["closed"]
                        row["automaticRetryConnections"] = len(row["webSockets"]) - 1
                        assert all(item["url"] == expected and item["errors"] == 0 for item in row["webSockets"]), row["webSockets"]
                    else:
                        assert len(row["webSockets"]) == 1, row["webSockets"]
                        socket = row["webSockets"][0]
                    assert socket["url"] == expected, socket
                    assert "hash" in socket["messageTypes"] and any(kind in socket["messageTypes"] for kind in ["ok", "warnings"]), socket
                    assert socket["errors"] == 0 and not socket["closed"], socket
                    assert row["responseStatuses"] == [101] * len(row["webSockets"]), row["responseStatuses"]
                    forbidden = [request for request in row["requests"] if any(part in request["url"] for part in ["/auth/guest", "/user/me", "/socket.io/", "/api/"])]
                    assert not forbidden, forbidden
                    assert all(urlsplit(request["url"]).netloc == parsed.netloc for request in row["requests"]), row["requests"]
                    await page.screenshot(path=str(output / f"hmr-{label}-1440x900.png"), animations="disabled", timeout=30000)
                    assert not socket["closed"] and socket["errors"] == 0, socket
                    row["expectedWebSocket"] = expected
                    row["guestRequests"] = 0
                    row["status"] = "PASS"
                except Exception as error:
                    row["status"] = "FAIL"
                    row["errorType"] = type(error).__name__
                    row["atFailure"] = json.loads(json.dumps({"webSockets": row["webSockets"], "responseStatuses": row["responseStatuses"]}))
                finally:
                    await asyncio.gather(*asset_tasks, return_exceptions=True)
                    if not page.is_closed():
                        try:
                            row["beforeCleanup"] = await page.evaluate("({path:location.pathname,readyState:document.readyState,nativeSockets:window.__compatHmrTrace||[],loginHeading:!!document.getElementById('login-title')})")
                        except Exception as error:
                            row["cleanupObservationError"] = type(error).__name__
                    await context.close()
            report["status"] = "PASS" if all(row["status"] == "PASS" for row in report["cases"]) else "FAIL"
            if report["status"] != "PASS":
                raise AssertionError("At least one independent direct/proxy case failed; see per-case evidence")
        except BaseException as error:
            report["status"] = "FAIL"
            report["errorType"] = type(error).__name__
            raise
        finally:
            await browser.close()
            (output / "browser-hmr.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
