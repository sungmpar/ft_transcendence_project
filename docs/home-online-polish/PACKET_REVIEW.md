# Independent review of packet preparation

**Accepted: the reproduced runtime-inclusion finding is resolved in the inspected source.** No package was generated or reverse patch check executed by this reviewer. Archive, manifest and patch success must come from the later actual packaging command.

Repository: `sungmpar/ft_transcendence_project`, `main`, baseline `2f11bee69c2d55ed938b53f9750119a890396fb7` with authorized uncommitted work. Reviewed [scripts/package-home-review.py](../../scripts/package-home-review.py). The reviewer changed this note only; the root implementation agent authored the script repair.

## Finding history and repair

Initial P2: `source()` accepted every file below `scripts/`, and the final inventory did not exclude caches. The initial read-only `git status` actually listed `scripts/__pycache__/`; it was gone by a later inventory, but the source predicate still accepted its `.pyc` files. Those files could therefore enter both the source patch and archive despite the runtime-exclusion requirement. No archive containing them was created during this review.

The repair uses a source extension allowlist and common `omitted()` rules for both inventories. Cache directories, Python bytecode, `.env*` and key-file names are filtered before patch and archive selection. Selected symlinks are rejected instead of followed. Text credential-pattern checks run before patch capture and again before archive creation without printing matched values. Source-content fingerprints and changed tracked names are compared after patch capture, so source changes during capture cause failure rather than silently receiving a success manifest.

Independent read-only verification executed `/opt/miniconda3/bin/python -`: parsed the script AST, loaded only `source`, `omitted` and `inventory` function definitions, and exercised twelve explicit path cases. **Exit0; 12/12 classifier cases and combined inventory assertion passed.** The command did not load or call `main()` and wrote no package artifacts. A current Git inventory selected74 source files, zero bytecode/cache files; all checked new D helpers (`event-presentation.ts`, `online-preferences.ts`, final browser test/script) remained included. These are snapshot counts while other agents are still working, not a final manifest count.

The Git operations remain reads (`diff`, `ls-files`, branch/ref/remote queries) and `git apply --check --reverse`. There is no non-check apply, add, commit, checkout, branch creation, push or configuration write. Actual main execution writes only the authorized new Goal review files and ZIP after its scope checks. It prints package success only after reverse patch validation and ZIP/hash checks complete.

## Scope and limits

A separate read-only scan of the current new Goal text evidence found no JWT-shaped value or private-key marker; it did not print file contents. This is a bounded pattern scan, not proof that arbitrary credential formats can never exist. A follow-up review noted that `.css`, `.mjs` and `.sh` were allowed source extensions but missing from the scanner's selected-text suffixes. Root extended that set; the reviewer re-read the source and confirmed those three suffixes are now scanned alongside `.md/.txt/.json/.log/.py/.ts/.js/.cjs/.vue/.patch`. The coverage recommendation is accepted and resolved in source. No credential was observed in those types, and no archive execution is inferred from this repair.

The recent Board/Chat/Info/Tfa source changes were also read. Board owns its labeled focusable horizontal scroll region and mobile header wrapping; Chat adds a composer class and scoped widths while preserving send/socket handlers; Info/Tfa use document flow instead of overlapping absolute footers. No additional source blocker was found. A subsequent independent actual Chrome run on fixed build `4de1388331743be3` completed37 specified checks with exit0; that execution, screenshots and limits are recorded in [SERVICE_LAYOUT_REVIEW.md](SERVICE_LAYOUT_REVIEW.md). The source inspection itself is not counted as a browser run.

The first service repair's28 checks remain intermediate evidence. D and packet execution results are not inferred by this review; final packaging success still requires the actual later command.
