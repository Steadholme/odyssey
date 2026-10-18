'use strict';
const $ = (s, scope = document) => scope.querySelector(s);
const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
const root = document.documentElement;
const storageKey = 'odyssey-patterns-demo.v1';
const motionSystem = matchMedia('(prefers-reduced-motion: reduce)');
const icons = {
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 inbox:'<path d="M4 4h16l2 11v5H2v-5L4 4Z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="var(--ody-surface)"/><circle cx="16" cy="17" r="3" fill="var(--ody-surface)"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 motion:'<path d="M7 4v16M12 7v10M17 10v4"/>',
 'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
 branch:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M18 7v2a5 5 0 0 1-5 5H6"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 file:'<path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v6h5M8 13h8M8 17h5"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',
 archive:'<path d="M4 8h16v13H4zM2 3h20v5H2zM9 12h6"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
 key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9M16 16l3-3M18 18l3-3"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2m-3-9-1 1M5 19l-1 1M3 3l2 2m14 14 2 2"/>',
 dot:'<circle cx="12" cy="12" r="3"/>',
 'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};
function icon(name, extra = '') { return `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`; }
function paintIcons(scope = document) { $$('[data-icon]', scope).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function makeEvent(title, body, who = 'You') { return {id:Date.now() + Math.random(), title, body, who, at:new Date().toISOString()}; }
const initialNotifications = [
 {id:'n1',category:'RELEASES',title:'Review is waiting for you',summary:'Release 54 · checkout-api · 1 of 2 approvals',body:'Emma has prepared the retry-policy update for checkout-api. The checks have passed, and your review is the last step before scheduling.',context:'Release 54 / checkout-api',contextBody:'Production · retry-policy update · 3 checks passed',at:'10:42 AM',read:false,action:true,icon:'layers',link:'releases',actionLabel:'Review release'},
 {id:'n2',category:'CHECKS',title:'All checks passed',summary:'Build, tests, and recovery checks are green.',body:'All three checks completed successfully for release 54. The build is reproducible, retry behavior is covered, and the recovery path is ready.',context:'3 of 3 checks passed',contextBody:'Build 42s · Tests 18s · Recovery 6s',at:'10:38 AM',read:true,action:false,icon:'check-circle',link:'checks',actionLabel:'View checks'},
 {id:'n3',category:'WORKSPACE',title:'Felix joined the workspace',summary:'Emma invited Felix as a workspace member.',body:'Felix accepted Emma’s invitation and joined Acme Studio. Your workspace is ready for the next handoff.',context:'Acme Studio / Members',contextBody:'Emma K. · Felix R. · You',at:'9:50 AM',read:false,action:false,icon:'users',link:'settings',actionLabel:'Open workspace settings'},
 {id:'n4',category:'SECURITY',title:'Preview token expires soon',summary:'Review your preview access settings.',body:'The preview token is due for rotation in seven days. In this demo workspace, reviewing this item records the acknowledgement without contacting a service.',context:'Preview environment',contextBody:'Rotation due in 7 days · No production access affected',at:'9:12 AM',read:false,action:true,icon:'key',link:'acknowledge',actionLabel:'Acknowledge reminder'},
 {id:'n5',category:'RELEASES',title:'Release 53 is live',summary:'checkout-api · published by Emma K.',body:'Release 53 completed its rollout. All checks remained healthy, and the recovery window closed without an issue.',context:'Release 53 / checkout-api',contextBody:'Production · Completed yesterday at 4:30 PM',at:'Yesterday',read:true,action:false,icon:'layers',link:'releases',actionLabel:'View current release'},
 {id:'n6',category:'WORKSPACE',title:'Weekly workspace digest',summary:'A quieter week. Three releases, zero incidents.',body:'Your team shipped three releases this week and kept every check green. There are two items that still need attention in the inbox.',context:'This week at Acme Studio',contextBody:'3 releases · 0 incidents · 2 members active',at:'Yesterday',read:false,action:false,icon:'mail',link:'inbox-action',actionLabel:'See items needing action'}
];
const defaults = {
 workspace:{name:'Acme Studio',slug:'acme-studio'},
 appearance:{expression:'line',theme:'light',density:'comfortable',reduced:false},
 release:{approved:false,scheduledAt:null,events:[]},
 notifications:initialNotifications
};
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) { saved = null; }
const state = saved && saved.workspace && saved.appearance && saved.release && Array.isArray(saved.notifications) ? saved : structuredClone(defaults);
// Theme controls and Settings share the same preference object.
if (!['line','soft','studio','signal'].includes(state.appearance.expression)) state.appearance.expression = 'line';
if (!['light','dark'].includes(state.appearance.theme)) state.appearance.theme = 'light';
if (!['comfortable','compact'].includes(state.appearance.density)) state.appearance.density = 'comfortable';
let currentView = ['releases','inbox','settings'].includes(new URLSearchParams(location.search).get('view')) ? new URLSearchParams(location.search).get('view') : 'releases';
let currentTab = 'changes';
let currentFile = 0;
let inboxFilter = 'all';
let inboxQuery = '';
let activeNotification = 'n2';
const selected = new Set();
let workspaceDraft = {...state.workspace};
let workspaceController = null;
let composingTarget = null;
let pendingView = null;
let lastSettingsField = 'workspace-name';
let undoOperation = null;
let toastReturnFocus = null;
let commandIndex = 0;
let lastDialogFocus = new Map();
function persist() { localStorage.setItem(storageKey,JSON.stringify(state)); }
function workspaceDirty() { return workspaceDraft.name !== state.workspace.name || workspaceDraft.slug !== state.workspace.slug; }
function applyAppearance() {
 const a = state.appearance;
 root.dataset.expression = a.expression; root.dataset.theme = a.theme; root.dataset.density = a.density;
 root.dataset.motion = a.reduced || motionSystem.matches ? 'reduced' : 'standard';
 $('#expression-control').value = a.expression; $('#theme-control').value = a.theme; $('#density-control').value = a.density;
 $('#motion-control').setAttribute('aria-pressed',String(a.reduced));
 $('#motion-control').title = motionSystem.matches ? 'System reduced motion is active' : 'Reduce motion';
 $('#footer-expression').textContent = `${a.expression.toUpperCase()} · ${a.theme.toUpperCase()} · ${a.density.toUpperCase()}`;
 $$('[name=expression]').forEach(input => { input.checked = input.value === a.expression; });
 $$('[name=theme]').forEach(input => { input.checked = input.value === a.theme; });
 $$('[name=density]').forEach(input => { input.checked = input.value === a.density; });
 if ($('#reduced-setting')) $('#reduced-setting').checked = a.reduced;
 if ($('#motion-status')) $('#motion-status').textContent = motionSystem.matches ? 'SYSTEM / Reduced motion is active' : a.reduced ? 'MANUAL / All movement is reduced' : 'SYSTEM / Motion preference respected';
 if ($('#appearance-description')) $('#appearance-description').textContent = `${capitalize(a.expression)} · ${capitalize(a.theme)} · ${capitalize(a.density)}`;
 $('meta[name=theme-color]').content = getComputedStyle(root).getPropertyValue('--ody-bg').trim();
}
function setAppearance(key,value,feedback = true) {
 state.appearance[key] = value; applyAppearance(); persist();
 if (feedback) notify('Appearance updated',`${capitalize(state.appearance.expression)} / ${capitalize(state.appearance.theme)} · kept on this device.`);
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function unreadCount() { return state.notifications.filter(n => !n.archived && !n.read).length; }
function syncReleaseNotification() {
 const notification=state.notifications.find(n=>n.id==='n1');
 const approved=state.release.approved, scheduled=state.release.scheduledAt;
 notification.title=scheduled?'Release 54 is scheduled':approved?'Release 54 is ready':'Review is waiting for you';
 notification.summary=`Release 54 · checkout-api · ${approved?'2':'1'} of 2 approvals`;
 notification.action=!approved;
 notification.actionLabel=approved?'View release':'Review release';
 notification.contextBody=scheduled?`Production · Scheduled for ${formatWhen(scheduled)}`:`Production · retry-policy update · 3 checks passed`;
 notification.body=scheduled?`Both reviewers approved checkout-api. Release 54 is scheduled for ${formatWhen(scheduled)} in this demo workspace.`:approved?'Both reviewers approved the retry-policy update. The release is ready to schedule.':'Emma has prepared the retry-policy update for checkout-api. The checks have passed, and your review is the last step before scheduling.';
}
function updateShell() {
 syncReleaseNotification();
 $$('[data-workspace-name]').forEach(el => { el.textContent = state.workspace.name; });
 const count = unreadCount(); $('#inbox-count').textContent = count; $('#inbox-count').hidden = count === 0;
 $('#settings-dirty-dot').hidden = !workspaceDirty();
 $$('[data-nav]').forEach(link => { if (link.dataset.nav === currentView) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
 $('#breadcrumb-current').textContent = capitalize(currentView);
 document.title = `${capitalize(currentView)} · Odyssey Patterns`;
}
function route(view, focus = false) {
 if (view === currentView) { if (focus) $('#page-title').focus({preventScroll:true}); return; }
 if (currentView === 'settings' && workspaceDirty()) { pendingView = view; openDialog('leave-dialog'); return; }
 currentView = view;
 const url = new URL(location.href); url.searchParams.set('view',view); history.replaceState(null,'',url);
 renderView();
 if (focus) $('#page-title').focus({preventScroll:true});
 window.scrollTo({top:0,behavior:'instant'});
}
function renderView() {
 if(workspaceController){workspaceController.destroy();workspaceController=null;}
 updateShell();
 if (currentView === 'releases') renderRelease();
 if (currentView === 'inbox') renderInbox();
 if (currentView === 'settings') renderSettings();
 paintIcons($('#main'));
 applyAppearance();
}
function notify(title,message,undo = null) {
 const toast = $('#toast');
 if (!toast.hasAttribute('data-open')) toastReturnFocus = document.activeElement;
 $('#toast-title').textContent = title; $('#toast-message').textContent = message;
 undoOperation = undo; $('#toast-undo').hidden = !undo;
 toast.inert = false; toast.setAttribute('data-open','');
}
function dismissToast() {
 const toast = $('#toast');
 if (toast.contains(document.activeElement)) (toastReturnFocus?.isConnected ? toastReturnFocus : $('#page-title')).focus();
 toast.removeAttribute('data-open'); toast.inert = true; undoOperation = null;
}
function openDialog(id) {
 const dialog = $('#' + id); lastDialogFocus.set(dialog,document.activeElement);
 if (id === 'schedule-dialog') {
 const when = new Date(Date.now()+30*60*1000); when.setSeconds(0,0);
 $('#schedule-time').value = toLocalInput(when); $('#schedule-time').min = toLocalInput(new Date(Date.now()+60000));
 $('#schedule-time').setAttribute('aria-invalid','false'); $('#schedule-error').hidden = true;
 $('#schedule-help').textContent = `Your local timezone · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
 }
 if (id === 'command-dialog') { $('#command-search').value = ''; filterCommands(); }
 if (!dialog.open) dialog.showModal();
 if (id === 'command-dialog') $('#command-search').focus();
 if (id === 'schedule-dialog') $('#schedule-time').focus();
}
function toLocalInput(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function formatWhen(iso) { return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso)); }
function statusLabel() { return state.release.scheduledAt ? 'Scheduled' : state.release.approved ? 'Ready to schedule' : 'In review'; }
function focusAfterRelease(id) { renderRelease(); paintIcons($('#main')); updateShell(); if ($('#'+id)) $('#'+id).focus({preventScroll:true}); }
const files = [
 {name:'retry.ts',path:'src/checkout/retry.ts',directory:'src / checkout',lines:[['h','@@ checkout retry policy @@'],[' ','import { delay } from "./timing";'],[' ',''],[' ','export async function retry(request) {'],['-','  const attempts = 2;'],['+','  const attempts = 3;'],['+','  const backoff = [100, 300, 900];'],[' ',''],[' ','  for (let i = 0; i < attempts; i++) {'],[' ','    try {'],[' ','      return await request();'],[' ','    } catch (error) {'],['-','      await delay(100);'],['+','      if (!error.retryable) throw error;'],['+','      await delay(backoff[i]);'],[' ','    }'],[' ','  }'],['-','  return null;'],['+','  throw new Error("Retry limit reached");'],[' ','}']]},
 {name:'release.yaml',path:'config/release.yaml',directory:'config',lines:[['h','@@ production release configuration @@'],[' ','service: checkout-api'],[' ','environment: production'],['-','revision: 53'],['+','revision: 54'],['+','retry_policy: exponential'],['+','max_attempts: 3'],[' ','healthcheck: /health'],[' ','recovery: previous-revision']]},
 {name:'retry.test.ts',path:'tests/retry.test.ts',directory:'tests',lines:[['h','@@ retry behavior coverage @@'],['+','describe("retry policy", () => {'],['+','  it("stops on non-retryable errors",'],['+','    async () => expectStopImmediately());'],['+',''],['+','  it("uses exponential backoff",'],['+','    async () => expectBackoff(100, 300, 900));'],['+','});']]}
];
function counts(file) { return {add:file.lines.filter(l=>l[0]==='+').length,remove:file.lines.filter(l=>l[0]==='-').length}; }
const allCounts = files.reduce((acc,file)=>({add:acc.add+counts(file).add,remove:acc.remove+counts(file).remove}),{add:0,remove:0});
function countMarkup(c) { return `<span class="change-count"><span class="add-count" aria-label="${c.add} additions">+${c.add}</span> <span class="remove-count" aria-label="${c.remove} deletions">−${c.remove}</span></span>`; }
function renderRelease() {
 $('#main').innerHTML = `<div class="page-heading"><div><p class="eyebrow">RELEASES / REVIEW</p><h1 id="page-title" tabindex="-1">A considered release.</h1><p class="subhead"><code>checkout-api</code> <span aria-hidden="true">/</span> Release 54 <span aria-hidden="true">·</span> Prepared by Emma K.</p></div><div class="heading-actions"><span class="badge ${state.release.scheduledAt || state.release.approved ? 'success':'pending'}">${icon(state.release.scheduledAt?'clock':state.release.approved?'check-circle':'dot')}${statusLabel()}</span><button class="button ${state.release.approved?'primary':'secondary'}" id="schedule-open" ${!state.release.approved?'disabled aria-describedby="approval-help"':''}>${icon('clock')}${state.release.scheduledAt?'Change time':'Schedule'}</button></div></div><div class="release-layout"><section class="review-main" aria-label="Release review"><div class="release-overview"><div>${icon('branch')}<span>retry-policy <span class="muted">→ main</span></span></div><div><span class="branch">8a72c4f</span></div><div>${icon('file')}<span>3 files changed</span></div><div>${countMarkup(allCounts)}</div></div><div class="tabs" role="tablist" aria-label="Release sections">${['changes','checks','activity'].map((tab,i)=>`<button id="tab-${tab}" role="tab" aria-selected="${currentTab===tab}" aria-controls="release-panel" tabindex="${currentTab===tab?0:-1}" data-tab="${tab}">${capitalize(tab)}${i<2?`<span class="tab-count">${i===0?'3':'3/3'}</span>`:''}</button>`).join('')}</div><section id="release-panel" role="tabpanel" aria-labelledby="tab-${currentTab}" tabindex="0">${releasePanel()}</section></section>${releaseAside()}</div>`;
 }
function releasePanel() {
 if (currentTab === 'changes') return renderDiff();
 if (currentTab === 'checks') return `<div class="checks-list">${[
 ['Build and bundle','Production bundle compiled successfully.','42s','Compiled checkout-api v0.54.0<br>Bundle size: 2.4 MB<br><strong>✓ Build completed without warnings</strong>'],
 ['Behavior tests','Retry boundaries and error handling are covered.','18s','42 tests passed · 0 failed<br>Backoff sequence: 100 / 300 / 900 ms<br><strong>✓ Non-retryable errors stop immediately</strong>'],
 ['Recovery readiness','Previous revision is available for recovery.','6s','Previous revision: release-53<br>Healthcheck: /health · 200 OK<br><strong>✓ Recovery reference validated</strong>']
 ].map(([title,desc,time,log])=>`<details class="check-item"><summary>${icon('check-circle')}<div><b>${title}</b><small>${desc}</small></div><span class="check-duration">${time}</span>${icon('chevron','chevron')}</summary><div class="check-log">${log}</div></details>`).join('')}</div><div class="review-note">${icon('info')}<p>These checks describe the sample release. <b>Review actions change example data on this device.</b></p></div>`;
 const history = [...state.release.events].reverse().concat([
 {title:'Emma approved release 54',body:'“Retry boundaries look good. Ready for a second review.”',who:'Emma K.',at:'10:14 AM'},
 {title:'All checks passed',body:'Build, behavior tests, and recovery readiness.',who:'system',at:'10:12 AM'},
 {title:'Release prepared',body:'Emma added three files to the retry-policy update.',who:'Emma K.',at:'10:04 AM'}
 ]);
 return `<ol class="timeline">${history.map(event=>`<li>${event.who==='system'?`<span class="event-marker">${icon('check')}</span>`:`<span class="avatar ${event.who==='You'?'you':''}">${event.who==='You'?'YL':'EK'}</span>`}<div><b>${escapeHTML(event.title)}</b><p>${escapeHTML(event.body)}</p><time>${event.at.includes('T')?formatWhen(event.at):event.at}</time></div></li>`).join('')}</ol>`;
}
function renderDiff() {
 const file = files[currentFile], c = counts(file); let oldLine = 0, newLine = 0;
 return `<div class="diff-workspace"><nav class="file-list" aria-label="Changed files"><p class="eyebrow">3 CHANGED FILES</p>${files.map((f,i)=>`<button class="file-button" data-file="${i}" aria-pressed="${currentFile===i}"><b>${f.name}</b><small>${f.directory}</small>${countMarkup(counts(f))}</button>`).join('')}</nav><div class="diff-panel"><div class="diff-heading"><b>${file.path}</b>${countMarkup(c)}</div><div class="diff-scroll" tabindex="0" aria-label="Code diff for ${file.path}; scroll horizontally to read long lines"><div class="diff-code">${file.lines.map(([type,line])=>{if(type!=='+'&&type!=='h')oldLine++;if(type!=='-'&&type!=='h')newLine++;return `<div class="diff-line ${type==='+'?'add':type==='-'?'remove':type==='h'?'hunk':''}"><span class="ln">${type==='+'||type==='h'?'':oldLine}</span><span class="ln">${type==='-'||type==='h'?'':newLine}</span><span class="sign" aria-label="${type==='+'?'Added':type==='-'?'Removed':''}">${type==='h'?'':type}</span><code>${escapeHTML(line)}</code></div>`;}).join('')}</div></div><div class="diff-footer"><span>Unified diff · ${c.add} additions, ${c.remove} deletions</span><span>UTF-8</span></div></div></div><div class="review-note">${icon('info')}<p><b>Review the behavior, not just the lines.</b><br>Transient failures retry with backoff. Other errors stop immediately.</p></div>`;
}
function releaseAside() {
 const r = state.release;
 return `<aside class="release-aside" aria-label="Release details"><section class="aside-section"><div class="aside-heading">Reviewers <small>${r.approved?'2':'1'} / 2 APPROVED</small></div><div class="step-track" aria-label="${r.approved?'2 of 2':'1 of 2'} reviewers approved"><span class="done"></span><span class="${r.approved?'done':''}"></span></div><div class="approval-row"><span class="avatar">EK</span><div><b>Emma K.</b><small>Approved · 10:14 AM</small></div>${icon('check-circle')}</div><div class="approval-row"><span class="avatar you">YL</span><div><b>You</b><small>${r.approved?'Approved in this session':'Your review is requested'}</small></div>${r.approved?icon('check-circle'):'<span class="approval-pending">PENDING</span>'}</div>${!r.approved?`<button class="button primary" id="approve-release">${icon('check')}Approve release</button>`:!r.scheduledAt?'<button class="text-button" id="withdraw-approval">Withdraw my approval</button>':''}<p class="aside-copy" id="approval-help" style="margin-top:12px">${r.approved?'Both reviewers have approved this release.':'One more approval before this release can be scheduled.'}</p></section><section class="aside-section"><div class="aside-heading">Release window <small>PRODUCTION</small></div><div class="release-status-title">${r.scheduledAt?formatWhen(r.scheduledAt):r.approved?'Ready when you are.':'Not scheduled yet.'}</div><p class="aside-copy">${r.scheduledAt?'Scheduled in this demo workspace. Nothing is deployed.':r.approved?'Choose a time that works for the team. You can change it before release.':'Once the review is complete, choose a release time.'}</p>${r.scheduledAt?'<button class="button secondary" id="cancel-schedule">Cancel schedule</button>':`<div class="owner-row" style="margin-top:16px">${icon('shield')}<span>Recovery reference available</span></div>`}</section><section class="aside-section"><div class="aside-heading">Details</div><dl class="metadata"><div><dt>Project</dt><dd><code>checkout-api</code></dd></div><div><dt>Release</dt><dd><code>54 / 8a72c4f</code></dd></div><div><dt>Environment</dt><dd>Production</dd></div><div><dt>Prepared by</dt><dd>Emma K.</dd></div></dl></section></aside>`;
}
function setReleaseTab(tab,focus = false) {
 currentTab = tab;
 $$('[data-tab]').forEach(button=>{const active = button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
 $('#release-panel').setAttribute('aria-labelledby','tab-'+tab); $('#release-panel').innerHTML=releasePanel();
 if(focus) $('#tab-'+tab).focus();
}
function approveRelease() {
 state.release.approved=true; state.release.events.push(makeEvent('You approved release 54','Both reviewers have approved. The release is ready to schedule.')); persist(); focusAfterRelease('schedule-open'); notify('Release approved','2 of 2 approvals · choose a release time when you’re ready.');
}
function cancelSchedule() {
 const previous=state.release.scheduledAt;state.release.scheduledAt=null;state.release.events.push(makeEvent('Schedule cancelled','Release 54 is ready to schedule again.'));persist();focusAfterRelease('schedule-open');notify('Schedule cancelled','The release is ready. Both approvals are kept.',()=>{state.release.scheduledAt=previous;state.release.events.push(makeEvent('Schedule restored',`Release 54 is scheduled for ${formatWhen(previous)}.`));persist();focusAfterRelease('schedule-open');});
}
function filteredNotifications() {
 const query = inboxQuery.toLowerCase().trim();
 return state.notifications.filter(n=>!n.archived && (inboxFilter==='all'||inboxFilter==='unread'&&!n.read||inboxFilter==='action'&&n.action) && (!query||`${n.title} ${n.summary} ${n.category} ${n.body}`.toLowerCase().includes(query)));
}
function renderInbox() {
 const active = state.notifications.filter(n=>!n.archived);
 $('#main').innerHTML=`<div class="page-heading"><div><p class="eyebrow">WORKSPACE / INBOX</p><h1 id="page-title" tabindex="-1">The important things.</h1><p class="subhead">A clear place for updates, decisions, and what comes next.</p></div><span class="badge pending" id="inbox-header-count">${unreadCount()} unread</span></div><div class="inbox-filters"><div class="filter-tabs" aria-label="Filter notifications"><button data-filter="all" aria-pressed="${inboxFilter==='all'}">All <small id="filter-all-count">${active.length}</small></button><button data-filter="unread" aria-pressed="${inboxFilter==='unread'}">Unread <small id="filter-unread-count">${unreadCount()}</small></button><button data-filter="action" aria-pressed="${inboxFilter==='action'}">Needs action <small id="filter-action-count">${active.filter(n=>n.action).length}</small></button></div><label class="search-field">${icon('search')}<input id="inbox-search" type="search" placeholder="Search inbox…" aria-label="Search inbox" value="${escapeHTML(inboxQuery)}"></label></div><div class="inbox-workspace" id="inbox-workspace"></div><p class="results-footnote" id="inbox-footnote"></p>`;
 renderInboxBody();
}
function renderInboxBody() {
 syncReleaseNotification();
 const items=filteredNotifications(), active=state.notifications.filter(n=>!n.archived);
 [...selected].forEach(id=>{if(!items.some(n=>n.id===id))selected.delete(id);});
 const selectedItems = items.filter(n=>selected.has(n.id));
 const current = state.notifications.find(n=>n.id===activeNotification&&!n.archived) || items[0] || active[0];
 activeNotification = current?.id || null;
 $('#inbox-workspace').innerHTML=`<div class="inbox-list-pane"><div class="selection-strip"><label class="check-label"><input id="select-all" type="checkbox" aria-label="Select all visible notifications" ${items.length?'':'disabled'}></label><span>${selectedItems.length?`${selectedItems.length} selected`:`${items.length} notification${items.length===1?'':'s'}`}</span>${selectedItems.length?`<button class="icon-button" id="bulk-read" aria-label="Mark selected as read" title="Mark as read">${icon('mail')}</button><button class="icon-button" id="bulk-archive" aria-label="Archive selected" title="Archive">${icon('archive')}</button><button class="icon-button" id="selection-clear" aria-label="Clear selection" title="Clear selection">${icon('close')}</button>`:'<span class="eyebrow" style="font-size:8px;margin-right:0">LATEST FIRST</span>'}</div><div class="inbox-list">${items.length?items.map(n=>`<article class="inbox-item ${!n.read?'unread':''} ${activeNotification===n.id?'selected':''}"><label class="check-label"><input type="checkbox" data-select="${n.id}" aria-label="Select ${escapeHTML(n.title)}" ${selected.has(n.id)?'checked':''}></label><button class="notification-button" data-notification="${n.id}" aria-current="${activeNotification===n.id?'true':'false'}"><div class="notification-meta"><span>${!n.read?'<i class="unread-dot" aria-label="Unread"></i>':''}${n.category}${n.action?' · ACTION':''}</span><time>${n.at}</time></div><b>${escapeHTML(n.title)}</b><p>${escapeHTML(n.summary)}</p></button></article>`).join(''):`<div class="empty-results">${icon(inboxQuery?'search':'inbox')}<h3>${inboxQuery?'No matching updates.':inboxFilter==='unread'?'You’re all caught up.':inboxFilter==='action'?'Nothing needs action.':'A clear inbox.'}</h3><p>${inboxQuery?'Try another search, or clear your filters.':inboxFilter==='all'?'Your archived updates can be restored with Undo.':'Switch to All to see the rest of your updates.'}</p><button class="button secondary small" id="clear-inbox-filters">${inboxQuery?'Clear search & filters':'Show all updates'}</button></div>`}</div></div><section class="notification-detail" aria-label="Notification details" id="notification-detail" tabindex="-1">${current?notificationDetail(current):`<div class="empty-results">${icon('check-circle')}<h3>Everything is in order.</h3><p>You’ve cleared the inbox. Your release review and workspace settings are still here.</p><button class="button secondary" data-nav="releases">Review release 54</button></div>`}</section>`;
 const all=$('#select-all'); all.checked=items.length>0&&selectedItems.length===items.length; all.indeterminate=selectedItems.length>0&&selectedItems.length<items.length;
 $('#inbox-header-count').textContent=`${unreadCount()} unread`;
 $('#filter-all-count').textContent=active.length;$('#filter-unread-count').textContent=unreadCount();$('#filter-action-count').textContent=active.filter(n=>n.action).length;
 $('#inbox-footnote').textContent=`${active.length} updates in your inbox · ${active.filter(n=>n.action).length} need action · Demo workspace`;
 updateShell();
}
function notificationDetail(n) {
 return `<button class="text-button detail-back" id="inbox-back">← Back to inbox</button><div class="detail-kicker"><span class="event-icon">${icon(n.icon)}</span><span class="badge ${n.action?'pending':''}">${n.action?'Needs action':n.read?'Read':'Unread'}</span></div><p class="eyebrow">${n.category} / ${n.at}</p><h2>${escapeHTML(n.title)}</h2><p class="detail-body">${escapeHTML(n.body)}</p><div class="detail-context"><b>${escapeHTML(n.context)}</b><p>${escapeHTML(n.contextBody)}</p></div><button class="button primary" id="notification-action" data-action-id="${n.id}">${escapeHTML(n.actionLabel)}${icon('arrow')}</button><div class="detail-footer"><button class="text-button" id="notification-read" data-action-id="${n.id}">${n.read?'Mark as unread':'Mark as read'}</button><button class="text-button" id="notification-archive" data-action-id="${n.id}">Archive update</button></div>`;
}
function focusInboxControl(preferredId) {
 const restored=preferredId?$(`[data-select="${preferredId}"]`):null;
 (restored || $('#select-all:not(:disabled)') || $('#inbox-search')).focus({preventScroll:true});
}
function mutateNotifications(ids,field,value,title,message) {
 const before=state.notifications.filter(n=>ids.includes(n.id)).map(n=>({id:n.id,value:n[field]}));
 before.forEach(item=>{state.notifications.find(n=>n.id===item.id)[field]=value;});selected.clear();persist();renderInboxBody();focusInboxControl();
 notify(title,message,()=>{before.forEach(item=>{state.notifications.find(n=>n.id===item.id)[field]=item.value;});persist();if(currentView==='inbox'){renderInboxBody();focusInboxControl(before[0]?.id);}updateShell();});
}
function renderSettings() {
 $('#main').innerHTML=`<div class="page-heading"><div><p class="eyebrow">WORKSPACE / SETTINGS</p><h1 id="page-title" tabindex="-1">Make room for your work.</h1><p class="subhead">The details, the rhythm, and the way your workspace feels.</p></div><span class="badge">WORKSPACE ADMIN</span></div><div class="settings-layout"><section class="settings-section"><div class="section-intro"><span class="section-index">01 / IDENTITY</span><h2>Workspace details</h2><p>A clear name and a familiar address for everyone on the team.</p><p><a class="button secondary" href="/examples/compositions/workspace-settings.html" target="_blank" rel="noopener">Standalone form ↗</a></p></div><form id="workspace-form" data-ody-composition="workspace-settings" novalidate><label class="field" for="workspace-name">Workspace name<input id="workspace-name" data-ody-workspace-name name="workspace-name" autocomplete="organization" value="${escapeHTML(workspaceDraft.name)}" aria-describedby="name-help name-error"><small id="name-help">The name your team sees across the workspace.</small><small class="error" id="name-error" data-ody-workspace-error="name" role="alert" hidden></small></label><label class="field" for="workspace-slug">Workspace URL<span class="slug-input"><span>odyssey.demo /</span><input id="workspace-slug" data-ody-workspace-slug name="workspace-slug" autocomplete="off" spellcheck="false" autocapitalize="none" value="${escapeHTML(workspaceDraft.slug)}" aria-describedby="slug-help slug-error"></span><small id="slug-help">Lowercase letters, numbers, and hyphens. 3–32 characters.</small><small class="error" id="slug-error" data-ody-workspace-error="slug" role="alert" hidden></small></label><div class="form-actions"><span class="save-status" id="save-status"><span data-ody-workspace-status-icon aria-hidden="true">✓</span><span data-ody-workspace-status>All changes saved</span></span><button type="button" class="button secondary" id="discard-workspace" data-ody-workspace-discard disabled>Discard</button><button type="submit" class="button primary" id="save-workspace" data-ody-workspace-save disabled>Save changes</button></div><p data-ody-workspace-error="save" class="error" role="alert" hidden></p></form></section><section class="settings-section"><div class="section-intro"><span class="section-index">02 / EXPRESSION</span><h2>Appearance</h2><p>One language, four expressions.<br>Your preference follows every view.</p></div><div><fieldset class="preference-field"><legend>Expression</legend><div class="expression-options">${['line','soft','studio','signal'].map(name=>`<label class="expression-option"><input type="radio" name="expression" value="${name}" ${state.appearance.expression===name?'checked':''}><span class="expression-swatch ${name}"><i></i><span></span></span><b>${capitalize(name)}</b></label>`).join('')}</div></fieldset><div class="appearance-row"><fieldset class="preference-field"><legend>Theme</legend><div class="segmented">${['light','dark'].map(name=>`<label><input type="radio" name="theme" value="${name}" ${state.appearance.theme===name?'checked':''}><span>${capitalize(name)}</span></label>`).join('')}</div></fieldset><fieldset class="preference-field"><legend>Density</legend><div class="segmented">${['comfortable','compact'].map(name=>`<label><input type="radio" name="density" value="${name}" ${state.appearance.density===name?'checked':''}><span>${capitalize(name)}</span></label>`).join('')}</div></fieldset></div><div class="appearance-preview"><span class="preview-mark">${icon('layers')}</span><div><b>Release 54 · checkout-api</b><p id="appearance-description"></p></div><span class="badge ${state.release.approved?'success':'pending'}">${statusLabel()}</span></div><p class="preference-help">Applied immediately. Workspace details stay as you left them.</p></div></section><section class="settings-section"><div class="section-intro"><span class="section-index">03 / RHYTHM</span><h2>Motion & accessibility</h2><p>Feedback when it helps.<br>Quiet when you need it.</p></div><div><div class="switch-row"><div><b id="reduced-label">Reduce motion</b><p>Use immediate state changes instead of movement. Your system’s reduced-motion setting always takes priority.</p></div><label class="switch-label"><input id="reduced-setting" type="checkbox" aria-labelledby="reduced-label" ${state.appearance.reduced?'checked':''}><span class="switch-track" aria-hidden="true"></span></label></div><p class="motion-status" id="motion-status"></p></div></section><div class="settings-footer">${icon('info')}<span>Settings are saved on this device.</span><button class="text-button" id="restore-appearance">Restore Line defaults</button></div></div>`;
 workspaceController=window.OdysseyCompositions.mountWorkspace($('#workspace-form'),{
  value:state.workspace,draft:workspaceDraft,
  onChange:next=>{workspaceDraft={...next.draft};updateShell();},
  onSave:value=>{state.workspace={...value};workspaceDraft={...value};persist();updateShell();notify('Workspace saved',`${state.workspace.name} · ${state.workspace.slug}`);return value;}
 });
 $('#workspace-form').addEventListener('ody:workspace-discard',()=>notify('Changes discarded','Your saved workspace details are restored.'));
}
function commandItems() {return $$('[data-command]').filter(button=>!button.hidden);}
function selectCommand(index){const items=commandItems();commandIndex=items.length?(index+items.length)%items.length:-1;$$('[data-command]').forEach(button=>button.setAttribute('aria-selected','false'));const item=items[commandIndex];if(item){item.setAttribute('aria-selected','true');$('#command-search').setAttribute('aria-activedescendant',item.id);}else $('#command-search').removeAttribute('aria-activedescendant');}
function filterCommands(){const query=$('#command-search').value.toLowerCase().trim();$$('[data-command]').forEach(button=>button.hidden=!button.textContent.toLowerCase().includes(query));$('#command-empty').hidden=commandItems().length>0;selectCommand(0);}

function isComposing(event){if(composingTarget&&!composingTarget.isConnected)composingTarget=null;return !!composingTarget || event.isComposing || event.keyCode===229;}
document.addEventListener('compositionstart',event=>{composingTarget=event.target;},true);
document.addEventListener('compositionend',event=>{if(composingTarget===event.target)composingTarget=null;},true);
// Input modality is set before click handlers, including synthetic keyboard clicks.
document.addEventListener('pointerdown',()=>{root.dataset.input='pointer';},true);
document.addEventListener('keydown',()=>{root.dataset.input='keyboard';},true);
$('#expression-control').addEventListener('change',event=>setAppearance('expression',event.target.value));
$('#theme-control').addEventListener('change',event=>setAppearance('theme',event.target.value));
$('#density-control').addEventListener('change',event=>setAppearance('density',event.target.value));
$('#motion-control').addEventListener('click',()=>setAppearance('reduced',!state.appearance.reduced,false));
motionSystem.addEventListener('change',applyAppearance);
$('#command-open').addEventListener('click',()=>openDialog('command-dialog'));
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$$('dialog').forEach(dialog=>{
 dialog.addEventListener('close',()=>{if(dialog.id==='leave-dialog'){(currentView==='settings'?$('#'+lastSettingsField):$('#page-title'))?.focus({preventScroll:true});return;}const previous=lastDialogFocus.get(dialog);if(previous?.isConnected)previous.focus({preventScroll:true});});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
});
$('#leave-keep').addEventListener('click',()=>{$('#leave-dialog').close();pendingView=null;$('#'+lastSettingsField)?.focus();});
$('#leave-dialog').addEventListener('cancel',()=>{pendingView=null;queueMicrotask(()=>$('#'+lastSettingsField)?.focus());});
$('#leave-dialog').addEventListener('close',()=>{if(pendingView!==null){pendingView=null;$('#'+lastSettingsField)?.focus();}});
$('#leave-discard').addEventListener('click',()=>{const next=pendingView;pendingView=null;workspaceDraft={...state.workspace};$('#leave-dialog').close();route(next,true);});
$('#schedule-form').addEventListener('submit',event=>{
 event.preventDefault();const value=$('#schedule-time').value,when=new Date(value);const invalid=!value||Number.isNaN(+when)||+when<=Date.now();
 $('#schedule-error').textContent=invalid?'Choose a release time in the future.':'';$('#schedule-error').hidden=!invalid;$('#schedule-time').setAttribute('aria-invalid',String(invalid));
 if(invalid){$('#schedule-time').focus();return;}
 state.release.scheduledAt=when.toISOString();state.release.events.push(makeEvent('Release scheduled',`Release 54 is scheduled for ${formatWhen(state.release.scheduledAt)}.`));persist();$('#schedule-dialog').close();focusAfterRelease('schedule-open');notify('Release scheduled',`${formatWhen(state.release.scheduledAt)} · demo workspace.`);
});
$('#schedule-time').addEventListener('input',()=>{if($('#schedule-time').getAttribute('aria-invalid')==='true'){$('#schedule-error').hidden=true;$('#schedule-time').setAttribute('aria-invalid','false');}});
$('#toast-dismiss').addEventListener('click',dismissToast);
$('#toast-undo').addEventListener('click',()=>{if(undoOperation){const undo=undoOperation;undoOperation=null;undo();if(document.activeElement===$('#toast-undo'))$('#page-title').focus({preventScroll:true});notify('Change undone','Your previous state is restored.');}});
$('#command-search').addEventListener('input',filterCommands);
$('#command-search').addEventListener('keydown',event=>{if(isComposing(event))return;if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();selectCommand(commandIndex+(event.key==='ArrowDown'?1:-1));}if(event.key==='Enter'){event.preventDefault();commandItems()[commandIndex]?.click();}});
$$('[data-command]').forEach(button=>button.addEventListener('click',()=>{
 const dialog=$('#command-dialog');
 if(button.dataset.command!=='theme')lastDialogFocus.delete(dialog);
 dialog.close();
 if(button.dataset.command==='theme')setAppearance('theme',state.appearance.theme==='light'?'dark':'light');else route(button.dataset.command,true);
}));
document.addEventListener('keydown',event=>{
 if(isComposing(event))return;
 if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if($('#command-dialog').open)$('#command-dialog').close();else if(!document.querySelector('dialog[open]'))openDialog('command-dialog');}
 const tab=event.target.closest('[data-tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=['changes','checks','activity'];const index=tabs.indexOf(currentTab);setReleaseTab(event.key==='Home'?'changes':event.key==='End'?'activity':tabs[(index+(event.key==='ArrowRight'?1:2))%3],true);}
});
document.addEventListener('click',event=>{
 const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();route(nav.dataset.nav,true);return;}
 const tab=event.target.closest('[data-tab]');if(tab){setReleaseTab(tab.dataset.tab);return;}
 const file=event.target.closest('[data-file]');if(file){currentFile=Number(file.dataset.file);$('#release-panel').innerHTML=renderDiff();$(`[data-file="${currentFile}"]`).focus({preventScroll:true});return;}
 const filter=event.target.closest('[data-filter]');if(filter){inboxFilter=filter.dataset.filter;selected.clear();$$('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button===filter)));renderInboxBody();return;}
 const item=event.target.closest('[data-notification]');if(item){activeNotification=item.dataset.notification;const n=state.notifications.find(n=>n.id===activeNotification);n.read=true;persist();renderInboxBody();const next=$(`[data-notification="${activeNotification}"]`);if(matchMedia('(max-width:1020px)').matches){$('#notification-detail').scrollIntoView({block:'start',behavior:'instant'});$('#notification-detail').focus({preventScroll:true});}else if(next)next.focus({preventScroll:true});else $('#notification-action')?.focus({preventScroll:true});return;}
 const button=event.target.closest('button');if(!button)return;
 if(button.id==='approve-release')approveRelease();
 if(button.id==='schedule-open')openDialog('schedule-dialog');
 if(button.id==='withdraw-approval'){state.release.approved=false;state.release.events.push(makeEvent('Approval withdrawn','You requested another review before scheduling.'));persist();focusAfterRelease('approve-release');notify('Approval withdrawn','Release 54 is back in review.');}
 if(button.id==='cancel-schedule')cancelSchedule();
 if(button.id==='inbox-back'){$('#inbox-workspace').scrollIntoView({block:'start',behavior:'instant'});($(`[data-notification="${activeNotification}"]`)||$('#inbox-search')).focus({preventScroll:true});}
 if(button.id==='clear-inbox-filters'){inboxFilter='all';inboxQuery='';selected.clear();$('#inbox-search').value='';$$('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.filter==='all')));renderInboxBody();$('#inbox-search').focus();}
 if(button.id==='selection-clear'){selected.clear();renderInboxBody();$('#select-all').focus();}
 if(button.id==='bulk-read')mutateNotifications([...selected],'read',true,'Updates marked as read',`${selected.size} updates · Undo is available.`);
 if(button.id==='bulk-archive')mutateNotifications([...selected],'archived',true,'Updates archived',`${selected.size} updates removed from the inbox.`);
 if(button.id==='notification-read'){const n=state.notifications.find(n=>n.id===button.dataset.actionId);n.read=!n.read;persist();renderInboxBody();$('#notification-read').focus();}
 if(button.id==='notification-archive')mutateNotifications([button.dataset.actionId],'archived',true,'Update archived','You can restore it with Undo.');
 if(button.id==='notification-action'){
 const n=state.notifications.find(n=>n.id===button.dataset.actionId);n.read=true;persist();updateShell();
 if(n.link==='releases'||n.link==='checks'){currentTab=n.link==='checks'?'checks':'changes';route('releases',true);}
 else if(n.link==='settings')route('settings',true);
 else if(n.link==='inbox-action'){inboxFilter='action';selected.clear();renderInbox();$('#inbox-search').focus();}
 else if(n.link==='acknowledge'){n.action=false;n.actionLabel='Acknowledged';n.link='acknowledged';n.contextBody='Reminder acknowledged in this demo workspace.';persist();renderInboxBody();$('#notification-action').focus();notify('Reminder acknowledged','This inbox item no longer needs action.');}
 else notify('Already acknowledged','You can keep this update or archive it.');
 }
 if(button.id==='restore-appearance'){state.appearance={...defaults.appearance};applyAppearance();persist();notify('Line defaults restored','Line / Light / Comfortable · system motion preference respected.');}
});
document.addEventListener('change',event=>{
 if(event.target.matches('[data-select]')){if(event.target.checked)selected.add(event.target.dataset.select);else selected.delete(event.target.dataset.select);const id=event.target.dataset.select;renderInboxBody();$(`[data-select="${id}"]`)?.focus({preventScroll:true});}
 if(event.target.id==='select-all'){const checked=event.target.checked;filteredNotifications().forEach(n=>checked?selected.add(n.id):selected.delete(n.id));renderInboxBody();$('#select-all').focus({preventScroll:true});}
 if(['expression','theme','density'].includes(event.target.name))setAppearance(event.target.name,event.target.value);
 if(event.target.id==='reduced-setting')setAppearance('reduced',event.target.checked,false);
});
document.addEventListener('input',event=>{
 if(event.target.id==='inbox-search'){inboxQuery=event.target.value;selected.clear();renderInboxBody();}
});
document.addEventListener('focusin',event=>{if(['workspace-name','workspace-slug'].includes(event.target.id))lastSettingsField=event.target.id;});
window.addEventListener('beforeunload',event=>{if(workspaceDirty()){event.preventDefault();event.returnValue='';}});
paintIcons();applyAppearance();renderView();
