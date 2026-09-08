import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path(__file__).resolve().parents[1] / 'docs/arcade-upgrade/evidence'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1050})
    context.route('**/*',lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:4173/') else route.abort())
    page=context.new_page()
    page.goto('http://127.0.0.1:4173/play/local?debug=1')
    print('route loaded',flush=True)
    page.get_by_test_id('start-match').click()
    print('start clicked',flush=True)
    page.keyboard.down('w');page.keyboard.down('ArrowDown')
    page.wait_for_timeout(3500)
    page.keyboard.up('w');page.keyboard.up('ArrowDown')
    state=page.evaluate('window.__ARCADE_DEBUG__.snapshot()')
    assert state['tick'] > 120
    page.screenshot(path=str(out/'local-live-rally.png'),full_page=True)
    (out/'p2-live-smoke.json').write_text(json.dumps({'clock':'real browser wall clock','tick':state['tick'],'phase':state['phase'],'paddles':[state['players']['left']['y'],state['players']['right']['y']],'browser':browser.version}))
    browser.close()
print('PASS: live wall-clock local rally',flush=True)
