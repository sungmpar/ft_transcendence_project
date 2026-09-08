"""Current Home and backend-free public routes. Real Chromium UI, no game-state writes.
Usage: python scripts/browser-home-visual.py http://127.0.0.1:<fixture-port>
The baseline account's storage state is read only from task-private /tmp, never evidence.
"""
import datetime, hashlib, json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
base = sys.argv[1].rstrip('/')
public = os.environ.get('ARCADE_PREVIEW_URL', 'http://127.0.0.1:4173')
out = Path(os.environ.get('ARCADE_EVIDENCE_DIR', Path(__file__).resolve().parents[1] / 'docs/home-online-polish/evidence'))
out.mkdir(parents=True, exist_ok=True)
storage = Path(os.environ.get('ARCADE_BASELINE_STORAGE', '/private/tmp/ft-home-baseline-state.json'))
use_baseline = False
if storage.exists():
    try:
        use_baseline = any(item.get('origin') == base for item in json.loads(storage.read_text()).get('origins', []))
    except (ValueError, OSError):
        pass
report = {'status': 'FAIL', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'fixture': 'same actual guest account and storage as before; loopback only', 'checks': [], 'screens': []}
def check(name, value, detail=None):
    report['checks'].append({'name':name, 'pass':bool(value), 'detail':detail})
    assert value, name
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('ARCADE_CHROMIUM_EXECUTABLE','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless=True)
    report['browser']=browser.version
    dist = Path(__file__).resolve().parents[1] / 'frontend/dist'
    report['builtIndexSha256'] = hashlib.sha256((dist / 'index.html').read_bytes()).hexdigest()
    report['builtAssets'] = sorted(p.name for p in (dist / 'js').glob('*.js'))
    context = browser.new_context(storage_state=str(storage) if use_baseline else None,viewport={'width':1440,'height':900})
    context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base+'/') else r.abort())
    page=context.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.goto(base+'/')
        if not use_baseline:
            page.get_by_test_id('guest-login').click()
            report['fixture'] = 'fresh actual guest account for reproduction; no prior baseline account available'
        page.get_by_test_id('home').wait_for()
        for w,h in [(1440,900),(1366,768),(1024,768),(390,844)]:
            page.set_viewport_size({'width':w,'height':h});page.screenshot(path=str(out/f'after-home-{w}x{h}.png'),full_page=True)
            bounds=page.get_by_test_id('home').bounding_box(); width=page.evaluate('document.documentElement.scrollWidth')
            check(f'Home {w} no horizontal overflow/rail overlap',width<=w and bounds['x']>=80 and bounds['x']+bounds['width']<=w+1)
            for mode in ['local','ai','online']:
                button=page.get_by_test_id('play-'+mode);check(f'Home {w} {mode} CTA visible',button.is_visible())
                if w>=1024:
                    box=button.bounding_box();check(f'Home {w} {mode} CTA first viewport',box['y']+box['height']<=h)
            report['screens'].append({'path':f'after-home-{w}x{h}.png','width':w,'height':h})
        page.get_by_test_id('account-menu').click();page.get_by_role('navigation',name='계정 설정').wait_for()
        check('mobile account actions accessible',page.get_by_role('navigation',name='계정 설정').get_by_role('link',name='2단계 인증').is_visible())
        page.keyboard.press('Escape');check('account Escape closes and restores focus',page.get_by_test_id('account-menu').evaluate('(e)=>document.activeElement===e') and not page.get_by_role('navigation',name='계정 설정').count())
        page.set_viewport_size({'width':1440,'height':900})
        page.keyboard.press('Space');check('account Space opens disclosure',page.get_by_role('navigation',name='계정 설정').is_visible());page.keyboard.press('Escape')
        page.keyboard.press('Tab');check('Tab reaches visible focused rule control',page.evaluate('document.activeElement.dataset.testid')=='rule-classic' and page.evaluate('getComputedStyle(document.activeElement).outlineStyle')!='none')
        page.evaluate("window.addEventListener('keydown', e => { window.__HOME_ARROW_PREVENTED__ = e.defaultPrevented }, {once:true})");page.keyboard.press('ArrowDown');check('Home arrows retain browser default',page.get_by_test_id('home').is_visible() and page.evaluate('window.__HOME_ARROW_PREVENTED__ === false && !window.__ARCADE_DEBUG__ && !window.__ONLINE_DEBUG__'))
        page.emulate_media(reduced_motion='reduce');check('reduced motion removes launch transitions',page.get_by_test_id('play-ai').evaluate('(e)=>getComputedStyle(e).transitionDuration')=='0s');page.emulate_media(reduced_motion='no-preference')
        page.get_by_test_id('rule-power').click();page.get_by_test_id('difficulty-hard').click();page.get_by_test_id('hub-human-keys').select_option('right')
        page.get_by_test_id('play-ai').click();page.get_by_test_id('start-match').wait_for()
        check('Home AI preserves rule/difficulty/key choice',all(v in page.url for v in ['rule=power','difficulty=hard','keys=right']))
        before=page.get_by_test_id('score-left').inner_text()+page.get_by_test_id('score-right').inner_text();page.wait_for_timeout(200)
        check('AI waits for explicit Start',page.get_by_test_id('start-match').is_visible() and before=='00')
        page.get_by_test_id('start-match').click();check('AI starts actual match',page.get_by_test_id('local-play').get_attribute('data-mode')=='ai' and not page.get_by_test_id('start-match').count())
        page.go_back();page.get_by_test_id('home').wait_for();page.get_by_test_id('play-local').click();page.get_by_test_id('start-match').wait_for();check('Home local actual entry', '/play/local' in page.url)
        page.go_back();page.get_by_test_id('home').wait_for();page.get_by_test_id('play-online').click();page.get_by_test_id('online-play').wait_for();check('Home online opens lobby without auto matching',page.get_by_test_id('online-play').inner_text()=='상대 찾기')
        page.screenshot(path=str(out/'after-online-lobby-1440x900.png'),full_page=True)
        page.goto(base+'/');page.get_by_test_id('home').wait_for();page.get_by_test_id('home-friends').click();page.locator('#friends-drawer').wait_for();page.keyboard.press('Escape');page.locator('#friends-drawer').wait_for(state='hidden');check('friends Escape focus returns',page.get_by_test_id('home-friends').evaluate('(e)=>document.activeElement===e'))
        page.route('**/user/image/*',lambda r:r.abort());page.reload();page.get_by_test_id('home').wait_for();page.wait_for_timeout(150);check('broken avatar has initial fallback',page.locator('.launch-avatar-fallback').is_visible())
        page.evaluate("document.documentElement.style.zoom='2'");page.screenshot(path=str(out/'after-home-200percent.png'),full_page=True);check('200 percent zoom no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));check('200 percent zoom controls stay inside cards',page.locator('.launch-card').evaluate_all('(cards)=>cards.every(c=>Array.from(c.querySelectorAll("button,select,a")).every(e=>e.getBoundingClientRect().right<=c.getBoundingClientRect().right+1 && e.getBoundingClientRect().left>=c.getBoundingClientRect().left-1))'));page.evaluate("document.documentElement.style.zoom=''")
        # Separate stress case after baseline-matched screenshots: use the real
        # authorized nickname endpoint within its ten-character limit, restore it.
        original = page.locator('.launch-nickname').inner_text()
        stress_name = '아주긴한글별명' + str(datetime.datetime.now().microsecond % 1000).zfill(3)
        def nickname(value):
            return page.evaluate("""async nickname => (await fetch('/user/nickname', {method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('token')},body:JSON.stringify({nickname})})).status""", value)
        check('Long Korean nickname accepted through real fixture API', nickname(stress_name) == 200)
        try:
            page.reload();page.get_by_test_id('home').wait_for()
            page.set_viewport_size({'width':390,'height':844})
            page.get_by_test_id('account-menu').click()
            bounds=page.get_by_role('navigation',name='계정 설정').bounding_box()
            check('Ten-character Korean nickname and mobile account menu fit',page.locator('.launch-nickname').inner_text()==stress_name and page.evaluate('document.documentElement.scrollWidth<=innerWidth') and bounds['x']>=80 and bounds['x']+bounds['width']<=391)
            page.screenshot(path=str(out/'after-home-long-nickname-390x844.png'),full_page=True)
            page.keyboard.press('Escape');page.set_viewport_size({'width':1440,'height':900})
        finally:
            check('Fixture nickname restored after stress case',nickname(original)==200)
        contrast=page.evaluate(r"""() => {
          const rgb = value => (value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
          const luminance = color => rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
          return ['.launch-card-description','.launch-key-note','.launch-online-note small','.launch-community small','.launch-help summary','.launch-card .arcade-button.primary'].map(selector=>{
            const el=document.querySelector(selector);let parent=el,bg='';
            while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent')break;parent=parent.parentElement;}
            const a=luminance(getComputedStyle(el).color),b=luminance(bg);
            return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
          });
        }""")
        check('Sampled launch body/help/button text meets 4.5:1 contrast',all(x['ratio']>=4.5 for x in contrast),contrast)
        check('Home runtime errors absent',not errors)
        context.close()
        for path in ['/play','/play/local','/play/ai']:
            c=browser.new_context(viewport={'width':1440,'height':900});requests=[]
            c.on('request',lambda r:requests.append(r.url));c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(public+'/') else r.abort());pg=c.new_page();pg.goto(public+path)
            if path=='/play':
                pg.get_by_test_id('play-hub').wait_for();pg.screenshot(path=str(out/'after-play-hub-1440x900.png'),full_page=True)
            else:
                pg.get_by_test_id('start-match').wait_for();pg.get_by_test_id('start-match').click();pg.wait_for_timeout(250)
            forbidden=[u for u in requests if '/auth/' in u or '/user/' in u or '/socket.io' in u or u.startswith('ws')]
            check(f'fresh backend-free {path} actual route and zero auth/socket requests',not forbidden);c.close()
        c=browser.new_context(viewport={'width':1440,'height':900});pg=c.new_page();pg.goto(base+'/login');pg.get_by_test_id('login-arcade-link').wait_for();pg.screenshot(path=str(out/'after-login-1440x900.png'),full_page=True);c.close()
        report['status']='PASS'
    finally:
        browser.close();(out/'home-visual-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
