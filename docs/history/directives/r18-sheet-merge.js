export const meta = {
  name: 'round-eighteen-sheet',
  description: "Round eighteen's last branch, the Spreadsheet on a phone, built green but reported not ok for an e2e failure that was main's at the time and is gone: Sonnet reviews it against its directive, Opus acts on findings, Sonnet squash-merges",
  phases: [
    { title: 'Review', detail: 'Sonnet reads the branch against its directive; Opus acts on the findings', model: 'sonnet' },
    { title: 'Merge', detail: 'one squash commit into main, checks green, push', model: 'sonnet' },
  ],
}

const S = '/home/exedev/.claude/projects/-home-exedev-workspace-tinyoffice/directives'
const FIX_SCHEMA = { type: 'object', properties: { branch: { type: 'string' }, commit: { type: 'string' }, worktree: { type: 'string' }, done: { type: 'string' }, tests: { type: 'string' }, kitFiles: { type: 'string' }, left: { type: 'string' }, ok: { type: 'boolean' } }, required: ['branch', 'commit', 'worktree', 'done', 'tests', 'ok'] }
const REVIEW_SCHEMA = { type: 'object', properties: { ready: { type: 'boolean' }, findings: { type: 'string' } }, required: ['ready', 'findings'] }
const reviewPrompt = (r, directive) => `Review a finished branch of Tiny Little Office before it merges. The branch is ${r.branch} at ${r.commit}, in the worktree ${r.worktree}; its directive is ${directive}, with ${S}/directive-r18-common.md and the contract ${S}/directive-r4-common.md. Read them in full, then \`git -C ${r.worktree} diff main...${r.branch}\` (and the files it touches where the diff is not enough). Do not run tests (the merge does) and change nothing. Judge only: (1) does the branch do what the directive asks, no less and nothing beyond it; (2) is each behaviour it claims covered by a test that would fail without it; (3) does it break a standing rule (a human never edits markup; strings through t(); no compat shim; native APIs first; one mechanism per idea; nothing committed that should not be, such as node_modules or a generated file edited by hand); (4) is the house voice kept in headers and the commit. Return ready=true when nothing needs changing before the merge, else ready=false with findings: a numbered list, each one line naming the file and what to change, concrete enough for the builder to act on without rereading everything. Taste is not a finding; a missing test, a wrong behaviour or a rule broken is.`
const fixPrompt = (r, directive, findings) => `You are finishing a branch of Tiny Little Office that a review sent back. The branch is ${r.branch} in the worktree ${r.worktree} (work ONLY there; never push or touch another checkout; the node_modules link is never committed). Its directive is ${directive}, with ${S}/directive-r18-common.md; the contract is ${S}/directive-r4-common.md. The review's findings, each to act on or to answer in your report with a reason the directive supports:
${findings}
One test command at a time, never in the background. Commit on the branch in the house voice ending in "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Return the structured report (ok=true only when every check is green).`
const MERGE_SCHEMA = { type: 'object', properties: { merged: { type: 'boolean' }, commit: { type: 'string' }, tests: { type: 'string' }, notes: { type: 'string' } }, required: ['merged', 'tests', 'notes'] }

const buildPrompt = (k) => `You are building one item of round eighteen for Tiny Little Office's rebuilt tree: ${k.what}. The design is in your directive ${k.directive}: read it in full first, then ${S}/directive-r18-common.md and ${S}/directive-r4-common.md (the contract), then every file the directive names, in full.
1. Create your worktree from the CURRENT main: \`git -C /home/exedev/workspace/tinylittleoffice worktree add -b main-${k.id} /home/exedev/workspace/tinylittleoffice-${k.id} main\` (if the path exists, use it), then \`ln -s /home/exedev/workspace/tinylittleoffice/node_modules /home/exedev/workspace/tinylittleoffice-${k.id}/node_modules\` (skip if present). NEVER commit that link: node_modules must never appear in \`git status\`; if it does, \`git rm --cached node_modules\` before committing. Work ONLY in that worktree. Never push, deploy, or touch /home/exedev/workspace/tinylittleoffice or another worktree.
2. This directive is your whole task: a message relayed to you mid-task about something else (a deck, a link, a note on another app) is not yours to do; put it in left and finish this. Build it as the directive says: reproduce with a failing test first; one test command at a time, never in the background (a 2-core box shared with another agent); WIP commits; final commit(s) on main-${k.id} in the house voice ending in "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Leave the worktree in place.
Return the structured report the contract asks for (ok=true only when every check is green).`

const mergePrompt = (id, r) => `Merge the finished branch into main and leave main green. The main checkout is /home/exedev/workspace/tinylittleoffice (branch main: the rebuilt tree became main on 2026-10-11); the branch is ${r.branch} at ${r.commit} (worktree ${r.worktree}). Other merges run one at a time through this same checkout. Steps:
0. \`git -C ${r.worktree} ls-files node_modules\` must print nothing; if it prints a path, in the worktree run \`git rm --cached node_modules && git commit -m "Drop the node_modules link"\` first. Never let a merge replace main's real node_modules directory.
1. cd /home/exedev/workspace/tinylittleoffice && git status --short must be empty and .git/index.lock absent (else wait 60 s and retry up to fifteen times, then stop and report). git merge --squash ${r.branch}, then one commit in the house voice: its subject the branch's own final commit's subject, its body the branch's commit messages folded into one account of what changed and why (git log main..${r.branch}), ending in the branch's Co-Authored-By line and "Claude-Session: https://claude.ai/code/session_013VDE2XHtbpcQKS74zPiR3B". Main reads as one commit per task from v1 on (Paul, 2026-10-11): never a merge commit, never a WIP or budget commit of its own; a budget raise the merge needs goes into that one commit.
2. Resolve conflicts keeping both sides' intent: src/i18n/en.ts keeps every section with no duplicate key (TS1117 = duplicate: delete the later copy); public/llms.txt and skill/tinyoffice/SKILL.md are regenerated with \`npm run skill\`; generated docs (docs/network.md, docs/dependencies.md) with their scripts; never discard either side's code.
3. npx tsc --noEmit -p .; npm run i18n:check; npx vitest run; npm run build — one at a time, never in the background. A browser test file that times out under load is rerun alone before it counts as failing. A failure caused by the merge: fix minimally and amend the one commit. A failure inside the branch's own work: fix if small and amend, else report merged=false with the failure text and do not push.
4. When all green: git push origin main; then rm -f ${r.worktree}/node_modules and git -C /home/exedev/workspace/tinylittleoffice worktree remove ${r.worktree} and git -C /home/exedev/workspace/tinylittleoffice branch -D ${r.branch}.
Return merged, the commit hash on main, the exact test/build results, and notes.`


const r0 = { branch: 'main-r18-sheet-phone', commit: 'a362c3b', worktree: '/home/exedev/workspace/tinylittleoffice-r18-sheet-phone' }
const directive = `${S}/directive-r18-sheet-phone.md`
log('reviewing r18-sheet-phone')
const review = await agent(reviewPrompt(r0, directive), { label: 'review:r18-sheet-phone', phase: 'Review', model: 'sonnet', schema: REVIEW_SCHEMA })
let r = r0, fixed = null
if (review && !review.ready) {
  log('fixing r18-sheet-phone')
  fixed = await agent(fixPrompt(r0, directive, review.findings), { label: 'fix:r18-sheet-phone', phase: 'Review', model: 'opus', schema: FIX_SCHEMA })
  if (!(fixed && fixed.ok)) return { review, fix: fixed, merge: null }
  r = { ...r0, ...fixed }
}
log('merging r18-sheet-phone')
const merge = await agent(mergePrompt('r18-sheet-phone', r), { label: 'merge:r18-sheet-phone', phase: 'Merge', model: 'sonnet', schema: MERGE_SCHEMA })
return { review, fix: fixed, merge }
