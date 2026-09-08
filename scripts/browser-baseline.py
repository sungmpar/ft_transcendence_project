"""Run against a build of baseline f970554; documents absence of public arcade routes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(__file__).resolve().parents[1] / 'docs/arcade-upgrade/evidence'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    blocked = []
    def filter_request(route):
        if route.request.url.startswith('http://127.0.0.1:4173/'):
            route.continue_()
        else:
            blocked.append(route.request.url.split('?')[0])
            route.abort()
    context.route('**/*', filter_request)
    page = context.new_page()
    results = {}
    for name in ['play', 'play/local', 'play/ai', 'game']:
        page.goto('http://127.0.0.1:4173/' + name)
        page.wait_for_url('**/login')
        results[name] = {'destination': '/login', 'public_game_available': False}
    page.screenshot(path=str(out / 'baseline-login.png'))
    (out / 'baseline-browser.json').write_text(json.dumps({'browser': browser.version, 'routes': results, 'blocked_external_requests': blocked}, indent=2))
    browser.close()
print('BASELINE CONFIRMED: /play, /play/local, /play/ai, /game require login; no game was played.')
