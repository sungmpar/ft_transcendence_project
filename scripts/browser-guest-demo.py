"""Exercise the real guest login and two-player UI on the disposable demo."""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/')
out = Path(__file__).resolve().parents[1] / 'docs/arcade-upgrade/evidence'
errors = []
report = {'status': 'FAIL', 'authentication': 'Actual /auth/guest cookie and existing browser router; no credential injection',
          'clock': 'real browser/server clock; synthetic key input; no game-state writes'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('ARCADE_CHROMIUM_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
    contexts, pages = [], []
    try:
        for _ in range(2):
            context = browser.new_context(viewport={'width': 1280, 'height': 1060})
            contexts.append(context)
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base + '/') else route.abort())
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base + '/login')
            page.get_by_role('button', name='게스트로 체험하기', exact=True).click()
            page.wait_for_function("!!localStorage.getItem('token')")
            page.goto(base + '/game?debug=1')
            page.get_by_test_id('online-play').wait_for()
            pages.append(page)
        started = time.monotonic()
        for page in pages: page.get_by_test_id('online-play').click()
        for page in pages:
            page.wait_for_function('!!window.__ONLINE_DEBUG__')
            page.get_by_test_id('online-court').click()
            page.keyboard.down('ArrowUp')
        while time.monotonic() - started < 90:
            if all(page.get_by_test_id('online-result').is_visible() for page in pages): break
            time.sleep(.2)
        for page in pages:
            page.keyboard.up('ArrowUp')
            page.get_by_test_id('online-result').wait_for(timeout=1000)
        results = [page.get_by_test_id('online-result').inner_text() for page in pages]
        assert all('저장되었습니다' in value for value in results), 'Result must explicitly confirm persistence'
        assert any('6' in value for value in results), 'A full six-point result is required'
        pages[0].screenshot(path=str(out / 'final-online-guest-finished.png'), full_page=True)
        for page in pages: page.get_by_test_id('online-rematch').click()
        for page in pages: page.wait_for_function('!!window.__ONLINE_DEBUG__ && window.__ONLINE_DEBUG__.latest().tick < 120')
        pages[0].get_by_test_id('online-menu').click()
        pages[0].wait_for_function('!window.__ONLINE_DEBUG__')
        assert not errors, 'Unexpected browser error'
        report.update(status='PASS', browser=browser.version, completeMatch=True, savedResultVisible=True,
                      rematch=True, menuDisposed=True, pageErrors=errors, elapsedSeconds=round(time.monotonic()-started,3))
    finally:
        for context in contexts: context.close()
        browser.close()
        (out/'final-online-guest-browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
