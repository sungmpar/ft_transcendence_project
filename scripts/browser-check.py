"""Actual Chromium against the built app, synthetic keys and accelerated Clock.
No state injection; backend, auth and socket requests are blocked and counted.
Build frontend with VUE_APP_ARCADE_DEBUG=true to enable copied diagnostic state.
"""
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('ARCADE_EVIDENCE_DIR', ROOT / 'docs/arcade-upgrade/evidence'))
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('ARCADE_PREVIEW_URL', 'http://127.0.0.1:4173')
report = {'clock': 'Playwright accelerated browser clock; synthetic keyboard; no state writes', 'checks': []}

def check(name, condition, detail=None):
    report['checks'].append({'name': name, 'pass': bool(condition), 'detail': detail})
    if not condition:
        raise AssertionError(name + ': ' + str(detail))

def state(page):
    return page.evaluate('window.__ARCADE_DEBUG__.snapshot()')

def advance(page, ms):
    page.clock.run_for(ms)

def finish_game(page, max_seconds=240):
    for elapsed in range(max_seconds):
        advance(page, 1000)
        snapshot = state(page)
        if snapshot['phase'] == 'finished':
            return {'accelerated_seconds': elapsed + 1, 'tick': snapshot['tick'],
                    'score': [snapshot['players']['left']['score'], snapshot['players']['right']['score']],
                    'winner': snapshot['winner']}
    raise AssertionError('Match did not reach its winning score within the test bound')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('ARCADE_CHROMIUM_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
    report['browser'] = browser.version
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, device_scale_factor=2, reduced_motion='reduce')
    blocked = []
    service_requests = []
    errors = []
    def network(route):
        request = route.request
        parsed = urlparse(request.url)
        if request.resource_type in ['fetch', 'xhr'] or '/socket.io' in parsed.path or parsed.path.startswith(('/user/', '/auth/')):
            service_requests.append(parsed.path)
            route.abort()
        elif request.url.startswith(BASE + '/'):
            route.continue_()
        else:
            blocked.append(parsed.netloc + parsed.path)
            route.abort()
    context.route('**/*', network)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('websocket', lambda socket: service_requests.append('websocket'))
    page.clock.install(time=datetime(2026, 9, 7, 8, 0, 0, tzinfo=timezone.utc))
    try:
        page.goto(BASE + '/play')
        page.get_by_test_id('play-hub').wait_for()
        page.clock.pause_at(datetime(2026, 9, 7, 10, 0, 0, tzinfo=timezone.utc))
        page.screenshot(path=str(OUT / 'local-hub.png'), full_page=True)
        check('Public hub without auth', '/play' in page.url)

        page.goto(BASE + '/play/local?debug=1&rule=classic')
        page.wait_for_function('!!window.__ARCADE_DEBUG__')
        page.get_by_test_id('start-match').click()
        advance(page, 100)
        before = state(page)
        page.keyboard.down('w'); page.keyboard.down('ArrowDown')
        advance(page, 200)
        after = state(page)
        check('Two keyboard sets move simultaneously', after['players']['left']['y'] < before['players']['left']['y'] and after['players']['right']['y'] > before['players']['right']['y'])
        page.keyboard.down('s')
        left_y = state(page)['players']['left']['y']
        advance(page, 150)
        check('Opposed movement is neutral', state(page)['players']['left']['y'] == left_y)
        page.keyboard.up('w'); page.keyboard.up('s'); page.keyboard.up('ArrowDown')
        page.keyboard.press('Escape')
        paused_tick = state(page)['tick']
        advance(page, 5000)
        check('Pause freezes time', state(page)['tick'] == paused_tick)
        page.get_by_test_id('resume-match').click()
        advance(page, 100)
        check('Explicit resume has bounded catch-up', 0 < state(page)['tick'] - paused_tick < 15)

        page.get_by_test_id('key-settings').click()
        settings_tick = state(page)['tick']
        page.get_by_test_id('binding-left-up').select_option('KeyS')
        check('Conflicting key map rejected', page.get_by_test_id('apply-bindings').is_disabled())
        page.get_by_test_id('binding-left-up').select_option('KeyQ')
        page.get_by_test_id('binding-left-up').focus()
        page.keyboard.press('ArrowDown')
        advance(page, 100)
        check('Form input does not advance paused game', state(page)['tick'] == settings_tick)
        page.get_by_test_id('binding-left-up').select_option('KeyQ')
        page.get_by_test_id('apply-bindings').click()
        if page.get_by_test_id('resume-match').is_visible(): page.get_by_test_id('resume-match').click()
        before = state(page)['players']['left']['y']
        page.keyboard.down('q'); advance(page, 100); page.keyboard.up('q')
        check('Remapped movement applies', state(page)['players']['left']['y'] < before)

        page.keyboard.down('q')
        page.evaluate('window.dispatchEvent(new Event("blur"))')
        tick = state(page)['tick']; advance(page, 1000)
        check('Window blur pauses and requires resume', state(page)['tick'] == tick and page.get_by_test_id('resume-match').is_visible())
        page.keyboard.up('q')
        page.get_by_test_id('resume-match').click(); advance(page, 100)
        before = state(page)
        page.set_viewport_size({'width': 1000, 'height': 850})
        after = state(page)
        check('Resize preserves game state', before == after)
        canvas_size = page.get_by_test_id('court').evaluate('(c) => ({width:c.width, css:c.getBoundingClientRect().width, dpr:devicePixelRatio})')
        check('DPR backing store tracks CSS size', abs(canvas_size['width'] - canvas_size['css'] * canvas_size['dpr']) < 3, canvas_size)
        page.set_viewport_size({'width': 1440, 'height': 1100})
        page.keyboard.down('q'); page.keyboard.down('ArrowDown')
        local_result = finish_game(page)
        page.keyboard.up('q'); page.keyboard.up('ArrowDown')
        check('Local full match ends at six', max(local_result['score']) == 6, local_result)
        page.screenshot(path=str(OUT / 'local-finished.png'), full_page=True)
        page.get_by_test_id('restart-match').click(); advance(page, 100)
        check('Local restart resets scores', [state(page)['players'][s]['score'] for s in ['left', 'right']] == [0, 0])
        page.get_by_test_id('menu-link').click(); advance(page, 1000)
        check('Route exit removes diagnostic session', page.evaluate('typeof window.__ARCADE_DEBUG__') == 'undefined')
        for _ in range(3):
            page.goto(BASE + '/play/local?debug=1')
            page.get_by_test_id('start-match').click(); advance(page, 100)
            check('Reentry owns a fresh match', state(page)['tick'] < 15)
            page.get_by_test_id('menu-link').click()
        page.goto(BASE + '/game')
        page.wait_for_url('**/login')
        check('Existing online route still requires auth', page.url.endswith('/login'))

        page.goto(BASE + '/play/ai?debug=1&difficulty=normal&keys=right&rule=power')
        page.get_by_test_id('start-match').click(); advance(page, 3000)
        page.keyboard.down('ArrowUp'); advance(page, 200); page.keyboard.up('ArrowUp')
        snapshot = state(page)
        debug = page.evaluate('window.__ARCADE_DEBUG__.ai()')
        check('AI human arrow layout controls left paddle', snapshot['players']['left']['y'] < 300)
        check('AI uses delayed observation', debug['observationTick'] < snapshot['tick'] and debug['difficulty'] == 'normal', debug)
        page.screenshot(path=str(OUT / 'ai-playing.png'), full_page=True)
        page.keyboard.down('ArrowUp')
        ai_result = finish_game(page)
        page.keyboard.up('ArrowUp')
        check('AI full match ends at six', max(ai_result['score']) == 6, ai_result)
        page.screenshot(path=str(OUT / 'ai-finished.png'), full_page=True)
        page.get_by_test_id('restart-match').click(); advance(page, 100)
        check('AI restart resets match and observation state', state(page)['players']['left']['score'] == 0 and state(page)['players']['right']['score'] == 0)
        page.get_by_test_id('menu-link').click()
        page.set_viewport_size({'width': 640, 'height': 900})
        page.screenshot(path=str(OUT / 'hub-small-screen.png'), full_page=True)
        check('No page runtime errors', not errors, errors)
        check('No backend/auth/Socket calls in local and AI flows', not service_requests, service_requests)
        check('No external asset dependency', not blocked, blocked)
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL'
        report['error'] = str(error)
        page.screenshot(path=str(OUT / 'browser-failure.png'), full_page=True)
        raise
    finally:
        report['service_requests'] = service_requests
        report['external_requests_blocked'] = blocked
        report['page_errors'] = errors
        (OUT / 'p2-browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        context.close(); browser.close()
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'browser': report['browser']}))
