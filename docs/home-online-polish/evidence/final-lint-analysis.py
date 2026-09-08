from pathlib import Path
import re,json,subprocess,argparse
parser=argparse.ArgumentParser()
parser.add_argument('--frontend-log', default='final-frontend-lint-after-connection-retry.log')
args=parser.parse_args()
root=Path.cwd(); evidence=root/'docs/home-online-polish/evidence'
def read(name):
    result={}; current=None
    for row in (evidence/name).read_text().splitlines():
        if row.startswith(str(root)):
            current=str(Path(row).relative_to(root)); result[current]=[]
        elif current:
            m=re.match(r'\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$',row)
            if m:result[current].append({'line':int(m[1]),'severity':m[3],'rule':m[5]})
    return result
changed={};path=None;line=0
for row in subprocess.check_output(['git','diff','--unified=0'],text=True).splitlines():
    if row.startswith('+++ b/'): path=row[6:];changed.setdefault(path,set())
    elif row.startswith('@@'): line=int(re.search(r'\+(\d+)',row)[1])
    elif row.startswith('+') and path: changed[path].add(line);line+=1
    elif not row.startswith('-') and not row.startswith('\\'): line+=1
for name in subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z']).decode().split('\0'):
    if name and name.startswith(('frontend/src/','backend/src/')) and Path(name).is_file():
        changed[name]=set(range(1,len(Path(name).read_text(errors='replace').splitlines())+1))
def counts(rows):return {level:sum(x['severity']==level for x in rows) for level in ['error','warning']}
def flat(value):return [x for rows in value.values() for x in rows]
report={'method':'Same src-only --no-fix commands as baseline. Added-line diagnostics include untracked src files. No rule suppression or unrelated formatting.',
        'latestLogs':{'frontend':args.frontend_log,'backend':'final-backend-lint-verified.log'}}
for area in ['frontend','backend']:
    before=read('baseline-'+area+'-lint.log');initial=read('final-'+area+'-lint.log')
    after=read('final-backend-lint-verified.log' if area=='backend' else args.frontend_log)
    delta=[]
    for name in sorted(set(before)|set(after)):
        a,b=counts(before.get(name,[])),counts(after.get(name,[]))
        if a!=b:delta.append({'path':name,'before':a,'after':b})
    added=[{'path':name,**issue} for name,rows in after.items() for issue in rows if issue['line'] in changed.get(name,set())]
    report[area]={'before':counts(flat(before)),'firstIntegrationAttempt':counts(flat(initial)),
                  'after':counts(flat(after)),'changedCountsByFile':delta,'diagnosticsOnAddedLines':added}
(evidence/'final-lint-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
