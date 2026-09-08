"""Same-page real browser recovery on the explicitly owned loopback fixture.

Uses real guest redirects and real Socket.IO transport loss. No credentials,
account identities, socket payloads or game state are written to evidence.
"""
import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('base')
parser.add_argument('--case', choices=['player', 'spectator'], default='player')
parser.add_argument('--phase', choices=['before', 'after'], default='before')
parser.add_argument('--transport-close', action='store_true', help='Close the actual WebSocket before context goes offline; no application state changes')
parser.add_argument('--evidence-tag', default='', help='Optional filename suffix for preserving earlier evidence')
args = parser.parse_args()
assert not args.evidence_tag or all(c.isalnum() or c == '-' for c in args.evidence_tag)
tag = '-' + args.evidence_tag if args.evidence_tag else ''
base = args.base.rstrip('/')
assert urlparse(base).hostname == '127.0.0.1' and urlparse(base).scheme == 'http'
out = Path(__file__).resolve().parents[1] / 'docs/home-online-polish/evidence'
report = {'case': args.case, 'phase': args.phase, 'status': 'FAIL',
          'at': datetime.now(timezone.utc).isoformat(), 'base': base,
          'authentication': 'Actual guest full HTTP redirect; no JWT injection',
          'fault': 'Playwright context offline/online; server recognition observed on peer',
          'clock': 'Real browser/server time; no game-state or UI-state mutation'}
if args.transport_close:
    report['fault'] = 'Actual browser WebSocket.close followed by context offline/online; controlled transport closure, not WAN/TCP fault'
contexts = []
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('ARCADE_CHROMIUM_EXECUTABLE',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
    report['browser'] = browser.version
    try:
        pages = []
        for index in range(3 if args.case == 'spectator' else 2):
            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            contexts.append(context)
            context.add_init_script('''(() => {
              const Original = window.WebSocket, sockets = new Set();
              window.WebSocket = class extends Original {
                constructor(...args) { super(...args); sockets.add(this); this.addEventListener('close', () => sockets.delete(this)); }
              };
              window.__RECOVERY_CLOSE_TRANSPORT__ = () => { for (const socket of sockets) socket.close(); };
            })();''')
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base + '/') else route.abort())
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror', lambda _error: errors.append('Uncaught browser error'))
            page.goto(base + '/login')
            page.get_by_role('button', name='게스트로 체험하기', exact=True).click()
            page.wait_for_url(lambda url: urlparse(str(url)).path != '/login')
            page.goto(base + ('/spectate?debug=1' if index == 2 else '/game?debug=1'))
            page.get_by_test_id('online-play').wait_for()
            pages.append(page)
        for page in pages[:2]:
            page.get_by_test_id('online-play').click()
        for page in pages[:2]:
            page.wait_for_function('!!window.__ONLINE_DEBUG__')
        report['started'] = True
        if args.case == 'player':
            previous_match = pages[0].evaluate('window.__ONLINE_DEBUG__.identity().matchId')
            report['lossInjectedAt'] = time.monotonic()
            if args.transport_close:
                pages[0].evaluate('window.__RECOVERY_CLOSE_TRANSPORT__()')
                pages[0].wait_for_timeout(50)
            contexts[0].set_offline(True)
            pages[1].get_by_test_id('online-status').filter(has_text='일시정지').wait_for(timeout=65000)
            recognized = time.monotonic()
            report['recognitionDelaySeconds'] = round(recognized - report.pop('lossInjectedAt'), 3)
            pages[1].get_by_test_id('online-result').wait_for(timeout=10000)
            report['graceUntilPeerResultSeconds'] = round(time.monotonic() - recognized, 3)
            contexts[0].set_offline(False)
            recovered = False
            deadline = time.monotonic() + 12
            while time.monotonic() < deadline:
                if pages[0].get_by_test_id('online-result').is_visible():
                    recovered = True
                    break
                pages[0].wait_for_timeout(150)
            report['samePageRecoveredResult'] = recovered
            report['reconnectedStatus'] = pages[0].get_by_test_id('online-status').inner_text()
            report['peerSavedResultVisible'] = '저장' in pages[1].get_by_test_id('online-result').inner_text()
            if args.phase == 'before':
                assert not recovered, 'Baseline unexpectedly recovered; candidate needs reevaluation'
                report['status'] = 'REPRODUCED'
            else:
                assert recovered, 'Same page remained stuck after reconnect expiry'
                assert pages[0].get_by_test_id('recovered-score').is_visible(), 'Confirmed winner/loser score must be visible'
                assert pages[0].get_by_test_id('online-score-left').count() == 0, 'Old left/right score must not masquerade as a recovered result'
                report.update(confirmedRecoveredScoreVisible=True, staleLeftRightScoreHidden=True)
                pages[0].screenshot(path=str(out / f'n1-recovered-result-after{tag}.png'), full_page=True, timeout=45000)
                for page in pages[:2]: page.get_by_test_id('online-rematch').click(no_wait_after=True)
                for page in pages[:2]:
                    page.wait_for_function('previous => !!window.__ONLINE_DEBUG__ && window.__ONLINE_DEBUG__.identity().matchId !== previous && window.__ONLINE_DEBUG__.latest().tick > 0', arg=previous_match)
                assert pages[0].evaluate('window.__ONLINE_DEBUG__.identity().matchId') == pages[1].evaluate('window.__ONLINE_DEBUG__.identity().matchId')
                report['rematchStarted'] = True
                report['rematchInteraction'] = 'Playwright mouse click(no_wait_after=True); both clients entered the same new match and received advancing ticks'
                report['status'] = 'PASS'
        else:
            watcher = pages[2]
            watcher.get_by_test_id('online-play').click()
            watcher.locator('.spectate-list button').first.click()
            watcher.get_by_test_id('online-play').click()
            watcher.wait_for_function('window.__ONLINE_DEBUG__?.identity().side === "spectator"')
            if args.transport_close:
                watcher.evaluate('window.__RECOVERY_CLOSE_TRANSPORT__()')
                watcher.wait_for_timeout(50)
            contexts[2].set_offline(True)
            watcher.get_by_test_id('online-status').filter(has_text='연결이 끊').wait_for(timeout=65000)
            watcher.wait_for_timeout(800)
            contexts[2].set_offline(False)
            tick_before = watcher.evaluate('window.__ONLINE_DEBUG__?.latest().tick || 0')
            watcher.wait_for_timeout(4000)
            tick_after = watcher.evaluate('window.__ONLINE_DEBUG__?.latest().tick || 0')
            report.update(observerTickAdvanced=tick_after > tick_before,
                          observerStatus=watcher.get_by_test_id('online-status').inner_text())
            if args.phase == 'before':
                assert tick_after == tick_before, 'Baseline observer recovered or fault did not disconnect; reevaluate'
                report['status'] = 'REPRODUCED'
            else:
                assert tick_after > tick_before, 'Observer failed to resubscribe'
                assert watcher.evaluate('window.__ONLINE_DEBUG__.metrics().inputMessages') == 0
                report['observerInputMessages'] = 0
                watcher.screenshot(path=str(out / f'n2-observer-reconnected-after{tag}.png'), full_page=True, timeout=45000)
                pages[0].screenshot(path=str(out / f'n2-player-still-playing-after{tag}.png'), full_page=True, timeout=45000)
                report['status'] = 'PASS'
        assert not errors, 'Unexpected browser error'
        report['pageErrors'] = errors
    except Exception as error:
        report['failure'] = type(error).__name__ + ': ' + str(error).split('\n')[0]
        raise
    finally:
        for context in contexts: context.close()
        browser.close()
        suffix = '-closed-transport' if args.transport_close else ''
        (out / f'n-{args.case}-recovery-{args.phase}{suffix}{tag}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
