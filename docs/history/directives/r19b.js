export const meta = {
  name: 'round-nineteen-b',
  description: "Round nineteen, beside the first part: the home page's wordmark aligned with the apps' icons below it at every width (Paul, 2026-10-12: on desktop, keep the logo aligned with the list of apps below). Opus builds, Sonnet reviews, Opus fixes, Sonnet squash-merges.",
  phases: [
    { title: 'Build', detail: 'Opus: the wordmark on the icons\' edge', model: 'opus' },
    { title: 'Review', detail: 'Sonnet reads the branch against its directive; Opus acts on the findings', model: 'sonnet' },
    { title: 'Merge', detail: 'one squash commit into main, checks green, push', model: 'sonnet' },
  ],
}

const S = '/home/exedev/.claude/projects/-home-exedev-workspace-tinyoffice/directives'
const SWEEP = '/home/exedev/.claude/projects/-home-exedev-workspace-tinyoffice/sweep'
const FIX_SCHEMA = { type: 'object', properties: { branch: { type: 'string' }, commit: { type: 'string' }, worktree: { type: 'string' }, done: { type: 'string' }, tests: { type: 'string' }, kitFiles: { type: 'string' }, left: { type: 'string' }, ok: { type: 'boolean' } }, required: ['branch', 'commit', 'worktree', 'done', 'tests', 'ok'] }
const REVIEW_SCHEMA = { type: 'object', properties: { ready: { type: 'boolean' }, findings: { type: 'string' } }, required: ['ready', 'findings'] }
const MERGE_SCHEMA = { type: 'object', properties: { merged: { type: 'boolean' }, commit: { type: 'string' }, tests: { type: 'string' }, notes: { type: 'string' } }, required: ['merged', 'tests', 'notes'] }
const CLASSIFY_SCHEMA = { type: 'object', properties: { area: { type: 'string' }, file: { type: 'string' }, candidates: { type: 'number' }, sure: { type: 'number' }, notes: { type: 'string' } }, required: ['area', 'file', 'candidates', 'sure', 'notes'] }

const AREAS = [
  { key: 'kit-a-l', what: 'src/kit/*.ts whose names start a through l' },
  { key: 'kit-m-z', what: 'src/kit/*.ts whose names start m through z' },
  { key: 'apps', what: 'src/apps, src/doc, src/api.ts, src/i18n, src/styles and every other file under src/ outside src/kit' },
  { key: 'docs', what: 'docs/ (NOT docs/directives and NOT docs/history), README.md, CONTRIBUTING.md, SECURITY.md, public/, skill/' },
  { key: 'tooling', what: 'test/, e2e/, scripts/, packages/, tinier/, .github/, package.json and its scripts' },
]

const classifyPrompt = (a) => `You are one classifier of round nineteen's dead code sweep for Tiny Little Office. Read ${S}/directive-r19-sweep.md in full first, then ${S}/directive-r19-common.md. Your area: ${a.what}, in the checkout /home/exedev/workspace/tinylittleoffice (branch main). You change NOTHING in the repository and run no tests. You read your area file by file and, for each candidate the directive's "What counts" describes, count its references across the WHOLE repository (grep over src test e2e scripts packages tinier public docs skill, never your area alone), and write the table the directive asks for to ${SWEEP}/${a.key}.md (mkdir -p ${SWEEP} first): one row per candidate with path, line, symbol or first words, kind, the evidence with the exact grep command you ran, and a confidence of sure, likely or check. A symbol referenced by a string (a command id, a custom element tag, a route, an i18n key, a format extension) is alive: say so and leave it out. For stale words, quote the sentence and say in a few words what is no longer true. Be fast and complete rather than careful about each one: the remover checks every row before acting. Return area, the file you wrote, the number of candidates, how many are sure, and notes (what you could not judge).`

const reviewPrompt = (r, directive) => `Review a finished branch of Tiny Little Office before it merges. The branch is ${r.branch} at ${r.commit}, in the worktree ${r.worktree}; its directive is ${directive}, with ${S}/directive-r19-common.md and the contract ${S}/directive-r4-common.md. Read them in full, then \`git -C ${r.worktree} diff --stat main...${r.branch}\` and the diff itself (and the files it touches where the diff is not enough). Do not run tests (the merge does) and change nothing. Judge only: (1) does the branch do what the directive asks, no less and nothing beyond it (for the sweep: nothing alive removed, nothing dead left that a list named without a reason in the report; for the move: no content change beyond paths); (2) is each behaviour it claims covered by a test that would fail without it (the lints the directive asks for); (3) does it break a standing rule (a human never edits markup; strings through t(); no compat shim; native APIs first; one mechanism per idea; nothing committed that should not be, such as node_modules or a generated file edited by hand; docs/directives, docs/history and CHANGELOG.md untouched); (4) is the house voice kept in rewritten sentences, headers and the commit. Return ready=true when nothing needs changing before the merge, else ready=false with findings: a numbered list, each one line naming the file and what to change, concrete enough for the builder to act on without rereading everything. Taste is not a finding; a wrong removal, a missing lint or a rule broken is.`
const fixPrompt = (r, directive, findings) => `You are finishing a branch of Tiny Little Office that a review sent back. The branch is ${r.branch} in the worktree ${r.worktree} (work ONLY there; never push or touch another checkout; the node_modules link is never committed). Its directive is ${directive}, with ${S}/directive-r19-common.md; the contract is ${S}/directive-r4-common.md. The review's findings, each to act on or to answer in your report with a reason the directive supports:
${findings}
One test command at a time, never in the background. Commit on the branch in the house voice ending in "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Return the structured report (ok=true only when every check is green).`

const buildPrompt = (k, extra = '') => `You are building one item of round nineteen for Tiny Little Office's rebuilt tree: ${k.what}. The design is in your directive ${k.directive}: read it in full first, then ${S}/directive-r19-common.md and ${S}/directive-r4-common.md (the contract), then every file the directive names, in full.${extra}
1. Create your worktree from the CURRENT main: \`git -C /home/exedev/workspace/tinylittleoffice worktree add -b main-${k.id} /home/exedev/workspace/tinylittleoffice-${k.id} main\` (if the path exists, use it), then \`ln -s /home/exedev/workspace/tinylittleoffice/node_modules /home/exedev/workspace/tinylittleoffice-${k.id}/node_modules\` (skip if present). NEVER commit that link: node_modules must never appear in \`git status\`; if it does, \`git rm --cached node_modules\` before committing. Work ONLY in that worktree. Never push, deploy, or touch /home/exedev/workspace/tinylittleoffice or another worktree.
2. This directive is your whole task: a message relayed to you mid-task about something else is not yours to do; put it in left and finish this. One test command at a time, never in the background (a 2-core box); WIP commits; final commit(s) on main-${k.id} in the house voice ending in "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Leave the worktree in place.
Return the structured report the contract asks for (ok=true only when every check is green).`

const mergePrompt = (id, r) => `Merge the finished branch into main and leave main green. The main checkout is /home/exedev/workspace/tinylittleoffice (branch main); the branch is ${r.branch} at ${r.commit} (worktree ${r.worktree}). Steps:
0. \`git -C ${r.worktree} ls-files node_modules\` must print nothing; if it prints a path, in the worktree run \`git rm --cached node_modules && git commit -m "Drop the node_modules link"\` first. Never let a merge replace main's real node_modules directory.
1. cd /home/exedev/workspace/tinylittleoffice && git status --short must be empty and .git/index.lock absent (else wait 60 s and retry up to fifteen times, then stop and report). git merge --squash ${r.branch}, then one commit in the house voice: its subject the branch's own final commit's subject, its body the branch's commit messages folded into one account of what changed and why (git log main..${r.branch}), ending in the branch's Co-Authored-By line and "Claude-Session: https://claude.ai/code/session_013VDE2XHtbpcQKS74zPiR3B". Main reads as one commit per task (Paul, 2026-10-11): never a merge commit, never a WIP or budget commit of its own. For the kit move, a squash loses git's rename detection only if content changed too; check \`git show --stat -M\` on the commit shows renames (R) and not deletes plus adds, and report it.
2. Resolve conflicts keeping both sides' intent; generated files with their scripts; never discard either side's code.
3. npx tsc --noEmit -p .; npm run lint; npm run i18n:check; npx vitest run; npm run build; then the smoke run on the built site, \`PW_PORT=4290 npx playwright test e2e/smoke.spec.ts e2e/keyboard.spec.ts e2e/a11y.spec.ts\` (the port because 4179 is the dev server's; a deploy by tag runs the same three specs, and a merge that skips them has twice stopped a deploy) — one at a time, never in the background. A browser test file that times out under load is rerun alone before it counts as failing. A failure caused by the merge: fix minimally and amend the one commit. A failure inside the branch's own work: fix if small and amend, else report merged=false with the failure text and do not push.
4. When all green: git push origin main; then rm -f ${r.worktree}/node_modules and git -C /home/exedev/workspace/tinylittleoffice worktree remove ${r.worktree} and git -C /home/exedev/workspace/tinylittleoffice branch -D ${r.branch}.
Return merged, the commit hash on main, the exact test/build results, and notes.`

const run = async (k, extra) => {
  log(`building ${k.id}`)
  let r = await agent(buildPrompt(k, extra), { label: `build:${k.id}`, phase: 'Build', model: 'opus', schema: FIX_SCHEMA })
  if (!(r && r.ok)) return { task: k.id, build: r, merge: null }
  log(`reviewing ${k.id}`)
  const review = await agent(reviewPrompt(r, k.directive), { label: `review:${k.id}`, phase: 'Review', model: 'sonnet', schema: REVIEW_SCHEMA })
  let fixed = null
  if (review && !review.ready) {
    log(`fixing ${k.id}`)
    fixed = await agent(fixPrompt(r, k.directive, review.findings), { label: `fix:${k.id}`, phase: 'Review', model: 'opus', schema: FIX_SCHEMA })
    if (!(fixed && fixed.ok)) return { task: k.id, build: r, review, fix: fixed, merge: null }
    r = { ...r, ...fixed }
  }
  log(`merging ${k.id}`)
  const m = await agent(mergePrompt(k.id, r), { label: `merge:${k.id}`, phase: 'Merge', model: 'sonnet', schema: MERGE_SCHEMA })
  return { task: k.id, build: r, review, fix: fixed, merge: m }
}

const logo = await run({ id: 'r19-logo', directive: `${S}/directive-r19-logo.md`, what: "the home page's wordmark standing on the apps' icons' edge at every width: the column's inset and the row's inset each named once and read by the header too, measured at 1440, 1100, 900 and 390 and in Arabic (Paul, 2026-10-12: on desktop, keep the logo aligned with the list of apps below)" })
return { logo }
