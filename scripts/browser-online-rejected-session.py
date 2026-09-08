"""Actual duplicate-tab conflict policy and explicit transport recovery regression.

Uses an actual guest context and a second tab sharing its browser storage. The
fixture writes aggregate server session counts from read-only inspection; no
credentials, account IDs, state assignment, or game socket injection are used.
"""
import argparse
import asyncio
import importlib.util
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

source = Path(__file__).with_name('browser-online-final.py')
spec = importlib.util.spec_from_file_location('owned_online_browser_checks', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


async def server_sample(path, predicate, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = json.loads(path.read_text())
            if predicate(value):
                return value
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        await asyncio.sleep(0.05)
    raise AssertionError('Actual fixture session count did not reach the required state')


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('base')
    parser.add_argument('--out', required=True)
    parser.add_argument('--server-observation', required=True)
    parser.add_argument('--observe-baseline', action='store_true', help='Observe old automatic recovery before failing the churn policy; game route only')
    args = parser.parse_args()
    base = args.base.rstrip('/')
    assert urlparse(base).scheme == 'http' and urlparse(base).hostname == '127.0.0.1'
    output, observation = Path(args.out).resolve(), Path(args.server_observation).resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'FAIL', 'at': datetime.now(timezone.utc).isoformat(),
              'viewport': [1440, 900], 'authentication': 'Actual guest HTTP redirect; duplicate tab shares its native browser context',
              'limits': 'Owned loopback fixture, automated browser input; aggregate read-only server session observation, no account or socket-state injection'}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless=True)
        checks = module.BrowserChecks(browser, base, output)
        report['browser'] = browser.version
        started = time.monotonic()
        owner = rejected = None
        row = None
        report['cases'] = []
        try:
            for route in (['/game'] if args.observe_baseline else ['/game', '/invite', '/spectate']):
                row = {'route': route, 'status': 'FAIL'}
                report['cases'].append(row)
                owner = await checks.guest(route + '?debug=1')
                await owner.wait_for_function('window.__FINAL_ONLINE_AUDIT__.read().openSockets === 1')
                await owner.get_by_test_id('online-play').wait_for()
                assert await owner.get_by_test_id('online-play').is_enabled()
                await server_sample(observation, lambda v: v['sessionCount'] == 1)
                rejected = await owner.context.new_page()
                rejected.set_default_timeout(20000)
                rejected.on('pageerror', lambda _: checks.page_errors.append('Uncaught browser error'))
                await rejected.goto(base + route + '?debug=1')
                await rejected.wait_for_function('''() => {
                  const a = window.__FINAL_ONLINE_AUDIT__.read();
                  return a.openSockets === 0 && a.transportHistory.some(e => e.type === 'game-error' && e.category === 'active-session-conflict') &&
                    a.transportHistory.some(e => e.type === 'transport-close');
                }''')
                assert (await checks.audit(owner))['openSockets'] == 1
                assert await owner.get_by_test_id('online-play').is_enabled()
                registered = await server_sample(observation, lambda v: v['sessionCount'] == 1)
                row['activeOwnerProtected'] = True
                first_rejection = await checks.audit(rejected)
                await asyncio.sleep(6)
                after_conflict = await checks.audit(rejected)
                reason_visible = await rejected.evaluate('''() => {
                  const status = document.querySelector('[data-testid=online-status]')?.textContent || '';
                  const notice = document.querySelector('[data-testid=online-connection-notice]')?.textContent || '';
                  return /이미 연결된|다른 탭|기존 탭/.test(status + notice);
                }''')
                row['conflictObservationSeconds'] = 6
                row['additionalAutomaticConnectionsWhileOwnerActive'] = after_conflict['socketsOpened'] - first_rejection['socketsOpened']
                row['conflictReasonRemainsVisible'] = reason_visible
                row['rejectedNativeHistory'] = after_conflict['transportHistory']
                assert (await checks.audit(owner))['openSockets'] == 1
                assert await owner.get_by_test_id('online-play').is_enabled()
                registered = await server_sample(observation, lambda v: v['sessionCount'] == 1)
                row['activeOwnerStillProtectedAfterObservation'] = True
                if not args.observe_baseline:
                    assert await rejected.get_by_test_id('online-connection-notice').is_visible()
                    assert row['additionalAutomaticConnectionsWhileOwnerActive'] == 0, 'Exact-conflict automatic attempts continued while original owner was active'
                    assert reason_visible, 'The conflict reason was lost while original owner was active'
                await checks.screenshot(rejected, route[1:] + '-rejected-session-while-owner-active.png')
                await owner.close()
                cleared = await server_sample(observation, lambda v: v['sequence'] > registered['sequence'] and not set(v['generations']).intersection(registered['generations']))
                row['originalServerOwnerRemoved'] = True
                row['serverSessionCountAfterOwnerClosed'] = cleared['sessionCount']
                row['originalServerGenerationAbsent'] = True
                origin, url = await rejected.evaluate('performance.timeOrigin'), rejected.url
                def connected_expression():
                    return '''(() => { const a = window.__FINAL_ONLINE_AUDIT__.read(), button = document.querySelector('[data-testid=online-play]');
                      return a.openSockets === 1 && button && !button.disabled; })()'''
                automatic = False
                if args.observe_baseline:
                    try:
                        await rejected.wait_for_function(connected_expression(), timeout=7000)
                        automatic = True
                    except Exception as error:
                        if type(error).__name__ != 'TimeoutError':
                            raise
                else:
                    # The stopped client must remain stopped until the actual button.
                    before_click = await checks.audit(rejected)
                    await asyncio.sleep(0.75)
                    after_close = await checks.audit(rejected)
                    assert after_close['openSockets'] == 0
                    assert after_close['socketsOpened'] == before_click['socketsOpened']
                    row['noAutomaticAttemptBeforeExplicitClick'] = True
                    row['postOwnerCloseObservationSeconds'] = 0.75
                row['automaticallyRecoveredAfterOwnerClosed'] = automatic
                retry = rejected.get_by_test_id('online-reconnect')
                row['explicitReconnectActionPresent'] = await retry.count() == 1
                if not automatic:
                    assert row['explicitReconnectActionPresent'], 'After original owner cleanup, the rejected page has no explicit reconnect action'
                    assert await retry.is_enabled()
                    before_retry = await checks.audit(rejected)
                    await retry.click(no_wait_after=True)
                    await rejected.wait_for_function(connected_expression())
                    after_retry = await checks.audit(rejected)
                    assert after_retry['socketsOpened'] == before_retry['socketsOpened'] + 1
                    row['samePageExplicitReconnect'] = True
                    row['exactlyOneNativeConnectionForClick'] = True
                assert rejected.url == url and await rejected.evaluate('performance.timeOrigin') == origin
                await server_sample(observation, lambda v: v['sequence'] > cleared['sequence'] and v['sessionCount'] == 1)
                row.update(sameDocumentNoReload=True, authorizedServerSessionRestored=True)
                row['finalNativeHistory'] = (await checks.audit(rejected))['transportHistory']
                await checks.screenshot(rejected, route[1:] + '-rejected-session-reconnected.png')
                if row['additionalAutomaticConnectionsWhileOwnerActive'] > 0 or not reason_visible:
                    row['status'] = 'REPRODUCED'
                    raise AssertionError('Active-session conflict causes continuing automatic connection attempts or loses its visible reason while the original owner remains protected')
                final_audit = await checks.audit(rejected)
                assert final_audit['openSockets'] == 1
                assert final_audit['inputPackets'] == 0
                assert await rejected.get_by_test_id('online-play').is_enabled()
                row['idleInputsZeroAfterScreenshot'] = True
                row['status'] = 'PASS'
                assert not checks.page_errors
                await checks.close_case()
                await server_sample(observation, lambda v: v['sessionCount'] == 0)
            report['status'] = 'PASS'
        except Exception as error:
            if row is not None and row.get('status') == 'REPRODUCED':
                report['status'] = 'REPRODUCED'
            report['failure'] = type(error).__name__ + ': ' + str(error).split('\n')[0]
            report['failureDiagnostics'] = []
            for label, page in [('owner', owner), ('rejected', rejected)]:
                if page is None or page.is_closed():
                    report['failureDiagnostics'].append({'page': label, 'closed': True})
                    continue
                try:
                    diagnostic = await page.evaluate('''() => {
                      const a = window.__FINAL_ONLINE_AUDIT__?.read(), button = document.querySelector('[data-testid=online-play]');
                      const status = document.querySelector('[data-testid=online-status]')?.textContent || '';
                      return {socketsOpened: a?.socketsOpened ?? null, openSockets: a?.openSockets ?? null,
                        history: a?.transportHistory || [], gameUi: !!button, playDisabled: button?.disabled ?? null,
                        statusConflict: status.includes('이미 연결된 게임 세션'),
                        statusDisconnected: status.includes('연결이 끊'),
                        statusWaiting: status.includes('재연결'), statusLookupFailure: status.includes('조회에 실패')};
                    }''')
                    report['failureDiagnostics'].append({'page': label, 'path': urlparse(page.url).path, **diagnostic})
                except Exception as diagnostic_error:
                    report['failureDiagnostics'].append({'page': label, 'diagnosticError': type(diagnostic_error).__name__})
            try:
                report['serverObservationAtFailure'] = json.loads(observation.read_text())
            except (FileNotFoundError, json.JSONDecodeError):
                report['serverObservationAtFailure'] = {'unavailable': True}
            if rejected is not None and not rejected.is_closed():
                try:
                    await rejected.screenshot(path=str(output / 'rejected-session-failure-diagnostic.png'), full_page=True, timeout=10000)
                except Exception as screenshot_error:
                    report['diagnosticScreenshotError'] = type(screenshot_error).__name__
            raise
        finally:
            report.update(pageErrors=checks.page_errors, elapsedSeconds=round(time.monotonic() - started, 3))
            try:
                await checks.close_case()
                await browser.close()
            finally:
                (output / 'online-rejected-session.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
                print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main())
