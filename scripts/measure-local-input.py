"""Same-browser software-stage latency; synthetic keys, no state injection."""
import json, math, os
from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path(__file__).resolve().parents[1] / 'docs/arcade-upgrade/measurements'
rows = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('ARCADE_CHROMIUM_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1050})
    page = context.new_page()
    page.goto('http://127.0.0.1:4173/play/local?debug=1')
    page.get_by_test_id('start-match').click()
    page.wait_for_timeout(2200)
    for trial in range(32):
        code = 'KeyW' if trial % 2 == 0 else 'KeyS'
        page.evaluate('''code => {
          const before = window.__ARCADE_DEBUG__.snapshot().players.left.y;
          window.__INPUT_STAGE_MEASUREMENT__ = new Promise((resolve, reject) => {
            let frame;
            const onKey = event => {
              if (event.code !== code) return;
              window.removeEventListener('keydown', onKey);
              const collected = performance.now();
              const observe = () => {
                const state = window.__ARCADE_DEBUG__.snapshot();
                if (state.players.left.y !== before) {
                  clearTimeout(timeout);
                  resolve({ milliseconds: performance.now() - collected, tick: state.tick,
                    previousY: before, currentY: state.players.left.y });
                } else frame = requestAnimationFrame(observe);
              };
              frame = requestAnimationFrame(observe);
            };
            const timeout = setTimeout(() => { window.removeEventListener('keydown', onKey);
              cancelAnimationFrame(frame); reject(new Error('No changed paddle observed within 2s')); }, 2000);
            window.addEventListener('keydown', onKey);
          });
        }''', code)
        key = 'w' if code == 'KeyW' else 's'
        page.keyboard.down(key)
        result = page.evaluate('window.__INPUT_STAGE_MEASUREMENT__')
        page.keyboard.up(key)
        result.update(trial=trial, warmup=trial<2, key=code)
        rows.append(result)
        page.wait_for_timeout(40)
    version = browser.version
    context.close(); browser.close()
values = sorted(row['milliseconds'] for row in rows if not row['warmup'])
report = {'status':'PASS','browser':version,'samples':len(values),'warmupSamples':2,
          'method':'Real browser clock, synthetic keydown. Same performance.now clock from the key listener to first RAF observer that sees changed logical paddle after runner rendering; software-stage observation upper bound, not optical or physical-key latency. No game-state writes.',
          'meanMs':sum(values)/len(values),'p50Ms':values[(len(values)-1)//2],
          'p95Ms':values[math.ceil((len(values)-1)*.95)],'maxMs':max(values),'rows':rows}
(out/'local-input-stages.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
