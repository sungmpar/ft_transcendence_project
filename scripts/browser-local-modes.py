"""Built-app Classic/Power and AI difficulty regression. Synthetic keys, accelerated
browser clock, copied diagnostic state only. No game-state writes or live service.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('ARCADE_EVIDENCE_DIR', ROOT / 'docs/home-online-polish/evidence/local-modes'))
BASE = os.environ.get('ARCADE_PREVIEW_URL', 'http://127.0.0.1:4173')
OUT.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'method': 'Actual Chrome; synthetic keyboard, accelerated Clock, read-only game diagnostics', 'requests': [], 'errors': []}

def check(name, valid, detail=None):
    report['checks'].append({'name': name, 'pass': bool(valid), 'detail': detail})
    if not valid: raise AssertionError(name + ': ' + str(detail))

def state(page): return page.evaluate('window.__ARCADE_DEBUG__.snapshot()')
def advance(page, ms): page.clock.run_for(ms)

def finish(page):
    for elapsed in range(240):
        advance(page, 1000)
        current = state(page)
        if current['phase'] == 'finished':
            return {'seconds': elapsed + 1, 'score': [current['players'][side]['score'] for side in ['left', 'right']], 'tick': current['tick']}
    raise AssertionError('Match did not finish within 240 accelerated seconds')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('ARCADE_CHROMIUM_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
    report['browser'] = browser.version
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    def network(route):
        parsed = urlparse(route.request.url)
        if route.request.resource_type in ['fetch', 'xhr'] or '/socket.io' in parsed.path or parsed.path.startswith(('/auth/', '/user/')):
            report['requests'].append(parsed.path); route.abort()
        elif route.request.url.startswith(BASE + '/'):
            route.continue_()
        else:
            report['requests'].append(parsed.netloc + parsed.path); route.abort()
    context.route('**/*', network)
    page = context.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('websocket', lambda s: report['requests'].append('websocket'))
    page.clock.install(time=datetime(2026, 9, 8, 0, 0, tzinfo=timezone.utc))
    try:
        page.goto(BASE + '/play')
        page.clock.pause_at(datetime(2026, 9, 8, 1, 0, tzinfo=timezone.utc))
        # Storage corruption is input data, never a simulation state override.
        page.evaluate("localStorage.setItem('transcendence.arcade.preferences.v1', '{broken')")
        page.goto(BASE + '/play/ai?debug=1')
        page.wait_for_function('!!window.__ARCADE_DEBUG__')
        check('Corrupted preferences fall back to Classic/Normal', state(page)['config']['mode'] == 'classic' and 'NORMAL' in page.locator('.player-right').inner_text())
        tick = state(page)['tick']; advance(page, 1500)
        check('Entering a mode does not start its simulation', state(page)['tick'] == tick and page.get_by_test_id('start-match').is_visible())

        page.goto(BASE + '/play/local?debug=1&rule=power')
        page.get_by_test_id('start-match').click(); advance(page, 1500)
        held = set(); activation = None
        # Track the actual ball using ordinary held keys until five real returns.
        for _ in range(1800):
            current = state(page)
            wanted = set()
            for side, up, down in [('left', 'w', 's'), ('right', 'ArrowUp', 'ArrowDown')]:
                paddle = current['players'][side]
                delta = current['ball']['y'] - (paddle['y'] + paddle['height'] / 2)
                if delta < -25: wanted.add(up)
                elif delta > 25: wanted.add(down)
            for key in held - wanted: page.keyboard.up(key)
            for key in wanted - held: page.keyboard.down(key)
            held = wanted
            for side, action in [('left', 'd'), ('right', 'ArrowLeft')]:
                if current['players'][side]['charge'] == 5 and current['phase'] == 'rally':
                    page.keyboard.press(action); advance(page, 25)
                    after = state(page)
                    if after['players'][side]['powered']:
                        activation = {'side': side, 'tick': after['tick'], 'charge': after['players'][side]['charge'], 'height': after['players'][side]['height']}
                        break
            if activation: break
            advance(page, 50)
        for key in held: page.keyboard.up(key)
        check('Local Power activates from five real returns via its actual key', activation is not None, activation)
        page.screenshot(path=str(OUT / 'local-power-active.png'), full_page=True)
        page.keyboard.down('w'); page.keyboard.down('ArrowDown')
        result = finish(page)
        page.keyboard.up('w'); page.keyboard.up('ArrowDown')
        check('Local Power completes a full match at six', max(result['score']) == 6, result)
        page.screenshot(path=str(OUT / 'local-power-finished.png'), full_page=True)
        page.get_by_test_id('restart-match').click(); advance(page, 100)
        check('Local Power rematch clears charge and score', all(state(page)['players'][s]['score'] == 0 and state(page)['players'][s]['charge'] == 0 and not state(page)['players'][s]['powered'] for s in ['left', 'right']))
        page.get_by_test_id('menu-link').click()

        for rule in ['classic', 'power']:
            for difficulty in ['easy', 'normal', 'hard']:
                page.goto(BASE + '/play/ai?debug=1&keys=right&rule=' + rule + '&difficulty=' + difficulty)
                page.get_by_test_id('start-match').click(); advance(page, 3000)
                current = state(page); debug = page.evaluate('window.__ARCADE_DEBUG__.ai()')
                check('AI ' + rule + '/' + difficulty + ' uses its selected rules and delayed observation', current['config']['mode'] == rule and debug['difficulty'] == difficulty and debug['observationTick'] < current['tick'], {'tick': current['tick'], 'ai': debug})
                page.keyboard.down('ArrowUp'); result = finish(page); page.keyboard.up('ArrowUp')
                check('AI ' + rule + '/' + difficulty + ' completes at six', max(result['score']) == 6, result)
                page.screenshot(path=str(OUT / ('ai-' + rule + '-' + difficulty + '-finished.png')), full_page=True)
                page.get_by_test_id('restart-match').click(); advance(page, 100)
                check('AI ' + rule + '/' + difficulty + ' restarts', all(state(page)['players'][s]['score'] == 0 for s in ['left', 'right']))
                page.get_by_test_id('menu-link').click()
                page.wait_for_url('**/play')
                page.wait_for_function("typeof window.__ARCADE_DEBUG__ === 'undefined'")
                check('AI ' + rule + '/' + difficulty + ' route releases its session', page.evaluate('typeof window.__ARCADE_DEBUG__') == 'undefined')
        check('No service or external requests', not report['requests'], report['requests'])
        check('No runtime errors', not report['errors'], report['errors'])
        report['status'] = 'PASS'
    except Exception as e:
        report['status'] = 'FAIL'; report['error'] = str(e)
        page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        context.close(); browser.close()
print(json.dumps({'status': report['status'], 'checks': len(report['checks'])}))
