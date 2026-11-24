#!/usr/bin/env node
// Builds the synthetic demo boards shown on the site (including Ultra coverage ledgers)
// and exports each as the real offline workspace HTML.
//   node site/scripts/make-demo.mjs
// Writes site/public/demo/board-zh.html and board-en.html. Everything goes through public CLIs;
// all code stubs, findings, slices, and probes are strictly synthetic.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CLI = path.join(REPO, 'bin', 'pinwhy.js');
const ULTRA_CLI = path.join(REPO, 'bin', 'pinwhy-ultra.js');
const OUT = path.join(REPO, 'site', 'public', 'demo');

const TEXT = {
  zh: {
    title: '内部 API 审计 · 演示',
    start: '审计入口：内部管理后台',
    goalAuth: '确认管理 API 的匿名访问边界',
    goalTenant: '确认导出链路的租户隔离',
    intent: '枚举前端 bundle 中的 API 路由',
    obsBundle: ['bundle 含 47 个 /api/v2/* 路径', '静态提取共得到 47 条唯一路由'],
    hyAuth: ['管理读接口可能遗漏统一鉴权', '路由分组挂载在 adminReadRouter，未见共享鉴权钩子'],
    hyReason: '路由枚举后形成新猜测',
    obsUsers: ['GET /api/v2/admin/users 无 Cookie 返回 200', '响应包含 total=12043 和用户角色'],
    obsWrite: ['写接口在匿名请求下返回 403', 'POST reset-password → 403，写路由单独挂载了 requireAdminSession'],
    fdAuth: ['管理读接口匿名暴露全量用户列表', 'adminReadRouter 未挂载会话中间件，匿名请求可直接读取全量管理员与租户成员名单。'],
    fRouter: ['复核路由定义：adminReadRouter 未挂载 requireAdminSession', '独立静态核对 src/routes/admin/index.ts，确认仅 adminWriteRouter 挂载会话中间件。'],
    qMiddleware: '读写路由是否挂载了不同的鉴权中间件',
    hint: '优先比较 router.get 与 router.post 的中间件参数',
    tenantReason: '切换到租户隔离分支',
    action: '使用低权限账号修改 export 请求中的 tenantId',
    obsExport: ['服务端接受任意 tenantId 并返回其他租户订单', '查询仅按请求参数过滤 tenant_id，未校验当前会话所属租户'],
    fdExport: ['导出接口存在跨租户数据越权', '调用方只需持有任一租户的导出权限，即可通过修改 tenantId 导出其他租户订单数据。'],
    hyFiles: ['异步导出文件可能存在可枚举下载路径', '导出任务完成后返回静态下载路径，需确认文件名生成规则与鉴权'],
    obsJob: ['jobId 为递增整数，/exports/<jobId>.csv 无鉴权', '连续两次导出生成 /exports/1042.csv 与 /exports/1043.csv，匿名可直接下载'],
    fdFiles: ['导出文件下载无鉴权且可枚举', '静态文件目录直接暴露递增 jobId 的 CSV 产物，无需会话即可遍历下载历史导出文件。'],
    qUpload: '上传内容能否与导出链路形成组合利用',
    obsSvg: '上传接口接受同源可访问的脚本 SVG',
    counter: '利用仍需要管理员访问，当前没有触发路径',
    cursorReason: '保留组合利用问题，等待后续条件',
    cp1: '已确认三个发现；当前停在上传与导出链路的组合利用问题。',
    hyCsrf: '管理写接口的 CSRF 防护可能不一致',
    obsCsrf: 'POST /api/v2/admin/roles 未校验 CSRF token',
    obsCsrfCookie: ['会话 Cookie 启用 SameSite=Strict 且仅接受 application/json', '跨站表单无法携带会话 Cookie，也无法触发 JSON 解析器。'],
    cp2: '研究分支：写接口 CSRF 存在 Cookie 同源边界约束；主线保持在组合利用问题。',
    condAuth: ['目标接口挂载在未包裹 requireAdminSession 的读路由分组', '仅 /api/v2/admin 读分组受影响；写分组已单独挂载会话校验。'],
    condTenant: ['调用方持有任一租户的导出权限且请求参数可指定目标 tenantId', '需要已登录的低权限租户账号以通过前置路由鉴权。'],
    condTrigger: ['管理员在同源会话下直接打开上传的 SVG 资源', '当前后台仅以附件下载方式引用导出文件，尚未发现自动内联渲染入口。'],
    lblAuthAnswer: '匿名请求可直接拉取全量用户列表',
    lblHyAuthAnswer: '读路由分组疑似遗漏统一鉴权中间件',
    lblHyCsrfAnswer: '管理写接口未见显式 CSRF token 校验',
    lblWriteScope: '写接口已拦截匿名请求，问题边界收敛在读接口分组',
    lblFRouter: '独立静态核对确认读路由缺少鉴权中间件',
    lblCondAuth: '读路由未挂载会话校验',
    lblExportAnswer: '导出处理器未校验 tenantId 与当前会话归属一致',
    lblCondTenant: '需具备任一租户的导出角色并控制 tenantId 参数',
    lblHyFilesAnswer: '异步导出产物路径可预测',
    lblFilesAnswer: '递增 jobId 的导出产物可直接匿名读取',
    lblCondTrigger: '需同源会话触发脚本执行',
    lblCsrfCounter: 'SameSite=Strict 与 JSON Content-Type 限制跨站发送会话凭据',
    ultra: {
      excludeNote: '合成演示数据的静态初始化脚手架，无运行时路由入口',
      notes: {
        index: '已静态核对读/写路由挂载边界，adminReadRouter 缺少 requireAdminSession',
        users: '已复核匿名 GET /api/v2/admin/users 响应，确认未绑定会话校验',
        write: '已核对写路由全部挂载 requireAdminSession，匿名 POST 返回 403',
        roles: '已核对 POST /roles 缺乏显式 CSRF token，但受 SameSite=Strict 与 JSON 解析约束',
        exportRoute: '已确认 export handler 直接采用 query.tenantId，未比对会话租户',
        upload: '已确认上传接受同源脚本 SVG，尚未见后台内联触发路径',
        worker: '已核对异步导出使用递增 jobId 生成 /exports/*.csv 且缺少鉴权校验',
        session: '已核对会话中间件：Cookie 设置 SameSite=Strict，强制 application/json',
      },
      probes: {
        adminProbe: '实测匿名 GET /api/v2/admin/users 是否受读路由分组中间件拦截',
        exportHeaderProbe: '验证导出响应头是否带 Content-Disposition: attachment',
        billingReplayProbe: '待测账单优惠券接口在并发核销下的幂等性边界',
      },
      probeNotes: {
        adminProbe: '已实测：未携带 Cookie 直接返回 200 及全量用户列表',
        exportHeaderProbe: '已核对：导出响应头设置 Content-Disposition: attachment 且附带 nosniff',
      },
    },
  },
  en: {
    title: 'Internal API audit · demo',
    start: 'Entry point: internal admin console',
    goalAuth: 'Map the anonymous access boundary of the admin API',
    goalTenant: 'Verify tenant isolation in the export pipeline',
    intent: 'Enumerate API routes in the frontend bundle',
    obsBundle: ['Bundle contains 47 /api/v2/* paths', 'Static extraction found 47 unique routes'],
    hyAuth: ['Admin read endpoints may skip shared auth', 'Read routes mount on adminReadRouter without a shared session hook'],
    hyReason: 'New hypothesis after route enumeration',
    obsUsers: ['GET /api/v2/admin/users returns 200 without a cookie', 'Response includes total=12043 and user roles'],
    obsWrite: ['Write endpoints return 403 to anonymous requests', 'POST reset-password → 403; write router mounts requireAdminSession'],
    fdAuth: ['Admin read API exposes the full user list anonymously', 'adminReadRouter omits session middleware, allowing unauthenticated reads of all users and roles.'],
    fRouter: ['Independent route review: adminReadRouter omits requireAdminSession', 'Static inspection of src/routes/admin/index.ts confirms only adminWriteRouter mounts session auth.'],
    qMiddleware: 'Do read and write routes mount different auth middleware?',
    hint: 'Compare middleware arguments of router.get and router.post first',
    tenantReason: 'Switch to the tenant isolation branch',
    action: 'Change tenantId in the export request as a low-privilege user',
    obsExport: ['Server accepts any tenantId and returns other tenants’ orders', 'Query filters by request tenantId without checking caller session tenant'],
    fdExport: ['Export API allows cross-tenant data access', 'Any authenticated caller with export permission can supply another tenantId to export foreign orders.'],
    hyFiles: ['Async export files may have enumerable download paths', 'Completed jobs return a static download path; check ID generation and auth'],
    obsJob: ['jobId is sequential and /exports/<jobId>.csv has no auth', 'Consecutive jobs produce /exports/1042.csv and /exports/1043.csv, readable without cookies'],
    fdFiles: ['Export downloads are unauthenticated and enumerable', 'Static export directory serves sequential jobId CSVs without checking session or tenant ownership.'],
    qUpload: 'Can uploads be chained with the export pipeline?',
    obsSvg: 'Upload endpoint accepts same-origin scriptable SVG',
    counter: 'Exploitation still needs admin access; no trigger path yet',
    cursorReason: 'Park the chaining question until conditions change',
    cp1: 'Three findings confirmed; paused on chaining uploads with exports.',
    hyCsrf: 'CSRF protection on admin writes may be inconsistent',
    obsCsrf: 'POST /api/v2/admin/roles does not check the CSRF token',
    obsCsrfCookie: ['Session cookie sets SameSite=Strict and route requires application/json', 'Cross-site form submits neither send the session cookie nor pass the JSON parser.'],
    cp2: 'Research branch: write-endpoint CSRF faces SameSite=Strict bounds; main line stays on chaining.',
    condAuth: ['Endpoint is mounted on the read router group without requireAdminSession', 'Applies to /api/v2/admin read routes; write routes enforce session checks.'],
    condTenant: ['Caller holds export permission on any tenant and controls the tenantId parameter', 'Requires an authenticated low-privilege account to pass the route gate.'],
    condTrigger: ['An admin opens the uploaded SVG directly in a same-origin session', 'Exports are downloaded as attachments; no inline rendering path found yet.'],
    lblAuthAnswer: 'Unauthenticated GET returns the full user directory',
    lblHyAuthAnswer: 'Read router group appears to skip shared auth middleware',
    lblHyCsrfAnswer: 'Admin write route lacks an explicit CSRF token check',
    lblWriteScope: 'Write routes reject anonymous calls; exposure is scoped to read routes',
    lblFRouter: 'Independent static check confirms read router omits session middleware',
    lblCondAuth: 'Read router omits session middleware',
    lblExportAnswer: 'Export handler does not compare request tenantId with caller tenant',
    lblCondTenant: 'Requires export role on any tenant and attacker-controlled tenantId',
    lblHyFilesAnswer: 'Async export artifact paths are predictable',
    lblFilesAnswer: 'Sequential jobId CSV files are served without auth',
    lblCondTrigger: 'Requires same-origin admin navigation to trigger script',
    lblCsrfCounter: 'SameSite=Strict and JSON Content-Type block cross-site credentialed requests',
    ultra: {
      excludeNote: 'Synthetic demo fixture seeder; no runtime route handlers',
      notes: {
        index: 'Verified router mount boundary: adminReadRouter omits requireAdminSession',
        users: 'Verified GET /api/v2/admin/users responds 200 anonymously without session cookie',
        write: 'Verified adminWriteRouter enforces requireAdminSession and rejects anon POST with 403',
        roles: 'Verified POST /roles skips explicit CSRF token, constrained by SameSite=Strict & JSON parser',
        exportRoute: 'Confirmed export handler reads query.tenantId without comparing caller session tenant',
        upload: 'Confirmed upload accepts same-origin SVG; no admin inline render trigger located',
        worker: 'Confirmed sequential jobId outputs under /exports/*.csv lack authorization checks',
        session: 'Verified session middleware enforces SameSite=Strict cookies and application/json bodies',
      },
      probes: {
        adminProbe: 'Verify unauthenticated GET /api/v2/admin/users against read-group middleware',
        exportHeaderProbe: 'Check Content-Disposition: attachment & nosniff headers on export downloads',
        billingReplayProbe: 'Test billing coupon redemption idempotency under concurrent requests',
      },
      probeNotes: {
        adminProbe: 'Observed 200 OK with full user directory returned without cookies',
        exportHeaderProbe: 'Confirmed export responses send Content-Disposition: attachment with nosniff',
      },
    },
  },
};

function writeStub(rootDir, relPath, totalLines, headline) {
  const full = path.join(rootDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const lines = [`// Synthetic demo source file: ${relPath}`, `// ${headline}`, ''];
  while (lines.length < totalLines) {
    const step = lines.length + 1;
    lines.push(`export function syntheticStep${step}(input: Record<string, unknown>) { return input; }`);
  }
  fs.writeFileSync(full, `${lines.join('\n')}\n`, 'utf8');
}

function seedSyntheticSourceTree(dir) {
  const files = [
    ['src/routes/admin/index.ts', 42, 'Mount adminReadRouter and adminWriteRouter handlers'],
    ['src/routes/admin/users.ts', 56, 'GET /api/v2/admin/users directory handler'],
    ['src/routes/admin/write.ts', 34, 'POST /api/v2/admin/reset-password behind requireAdminSession'],
    ['src/routes/admin/roles.ts', 48, 'POST /api/v2/admin/roles assignment endpoint'],
    ['src/routes/admin/export.ts', 132, 'Export orders filtered by query.tenantId'],
    ['src/routes/upload.ts', 98, 'Multipart asset & SVG upload endpoint'],
    ['src/jobs/export-worker.ts', 76, 'Sequential jobId CSV output writer'],
    ['src/middleware/session.ts', 32, 'SameSite=Strict session cookie and JSON guard'],
    ['src/billing/invoice.ts', 46, 'Pending billing sweep target'],
    ['src/webhooks/notify.ts', 42, 'Pending webhook verification target'],
    ['scripts/seed-fixtures.ts', 32, 'Synthetic demo dataset helper'],
  ];
  for (const [rel, count, headline] of files) writeStub(dir, rel, count, headline);
}

export function createDemoDir(lang) {
  const T = TEXT[lang];
  if (!T) throw new Error(`Unsupported demo language: ${lang}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pinwhy-site-demo-${lang}-`));
  seedSyntheticSourceTree(dir);

  const runCli = (entry, ...args) => execFileSync(process.execPath, [entry, ...args, '--cwd', dir], {
    cwd: dir, env: { ...process.env, PINWHY_CWD: dir, PINWHY_QUIET: '1' }, encoding: 'utf8',
  }).trim();
  const bb = (...args) => runCli(CLI, ...args);
  const ultra = (...args) => runCli(ULTRA_CLI, ...args);
  const add = (kind, title, ...args) => JSON.parse(bb('node', 'add', kind, title, ...args, '--json')).node.id;
  const link = (a, b, rel, label, ...extra) => bb('link', a, b, '--rel', rel, ...(label ? ['--label', label] : []), ...extra);

  bb('init', '--here', '--title', T.title);
  const start = add('start', T.start, '--enter');
  const goalAuth = add('goal', T.goalAuth);
  const goalTenant = add('goal', T.goalTenant);
  link(start, goalAuth, 'related-to');
  link(start, goalTenant, 'related-to');

  const intent = add('intent', T.intent, '--status', 'done');
  const obsBundle = add('observation', T.obsBundle[0], '-d', T.obsBundle[1], '--at', 'dist/assets/admin-bundle.js:1420');
  link(intent, goalAuth, 'related-to');
  link(obsBundle, intent, 'derived-from');

  const hyAuth = add('hypothesis', T.hyAuth[0], '-d', T.hyAuth[1], '--at', 'src/routes/admin/index.ts:28', '--enter', '--reason', T.hyReason);
  link(obsBundle, hyAuth, 'supports');
  const obsUsers = add('observation', T.obsUsers[0], '-d', T.obsUsers[1], '--at', 'evidence/admin-users.http:12');
  const obsWrite = add('observation', T.obsWrite[0], '-d', T.obsWrite[1], '--at', 'src/routes/admin/write.ts:19');
  link(obsUsers, hyAuth, 'supports');
  const fdAuth = add('finding', T.fdAuth[0], '-d', T.fdAuth[1], '--at', 'src/routes/admin/users.ts:42', '--sev', 'critical', '--status', 'confirmed');
  link(obsUsers, fdAuth, 'proves');
  link(fdAuth, hyAuth, 'refines');
  link(obsWrite, fdAuth, 'related-to', T.lblWriteScope);

  const qMiddleware = add('question', T.qMiddleware);
  link(qMiddleware, hyAuth, 'derived-from');
  const hint = add('hint', T.hint);
  link(hint, qMiddleware, 'related-to');

  bb('cursor', goalTenant, '--reason', T.tenantReason);
  const action = add('action', T.action, '--enter');
  link(action, goalTenant, 'related-to');
  const obsExport = add('observation', T.obsExport[0], '-d', T.obsExport[1], '--at', 'src/routes/admin/export.ts:118');
  link(obsExport, action, 'derived-from');
  const fdExport = add('finding', T.fdExport[0], '-d', T.fdExport[1], '--at', 'src/routes/admin/export.ts:118', '--sev', 'high', '--status', 'confirmed');
  link(obsExport, fdExport, 'proves');

  const hyFiles = add('hypothesis', T.hyFiles[0], '-d', T.hyFiles[1], '--at', 'src/jobs/export-worker.ts:51');
  link(hyFiles, obsExport, 'derived-from');
  const obsJob = add('observation', T.obsJob[0], '-d', T.obsJob[1], '--at', 'src/jobs/export-worker.ts:64');
  link(obsJob, hyFiles, 'supports');
  const fdFiles = add('finding', T.fdFiles[0], '-d', T.fdFiles[1], '--at', 'src/jobs/export-worker.ts:64', '--sev', 'high', '--status', 'confirmed');
  link(obsJob, fdFiles, 'proves');

  const qUpload = add('question', T.qUpload, '--status', 'deferred');
  link(fdExport, qUpload, 'related-to');
  link(fdFiles, qUpload, 'related-to');
  const obsSvg = add('observation', T.obsSvg, '--at', 'src/routes/upload.ts:53');
  link(obsSvg, qUpload, 'supports');
  const counter = add('observation', T.counter, '--at', 'src/routes/upload.ts:87');
  link(counter, qUpload, 'contradicts');

  bb('cursor', qUpload, '--reason', T.cursorReason);
  bb('checkpoint', '--summary', T.cp1);

  // Edits give the records a history; a second Agent cross-verifies fdAuth and investigates CSRF on a side branch.
  bb('edit', fdAuth, '--confidence', 'suspected');
  bb('edit', fdAuth, '--confidence', 'reproduced');
  bb('edit', hyAuth, '--status', 'confirmed');
  bb('edit', fdFiles, '--confidence', 'static-confirmed');
  const R = ['--agent', 'agent:research'];
  const fRouter = add('fact', T.fRouter[0], ...R, '-d', T.fRouter[1], '--status', 'confirmed', '--confidence', 'static-confirmed', '--at', 'src/routes/admin/index.ts:28');
  link(fRouter, fdAuth, 'supports', T.lblFRouter, ...R);
  link(obsBundle, fRouter, 'supports');

  const hyCsrf = add('hypothesis', T.hyCsrf, ...R, '--at', 'src/routes/admin/roles.ts:31', '--enter');
  link(hyCsrf, goalAuth, 'answers', T.lblHyCsrfAnswer, ...R);
  const obsCsrf = add('observation', T.obsCsrf, ...R, '--at', 'src/routes/admin/roles.ts:38', '--to', hyCsrf, '--rel', 'supports', '--tag', 'csrf');
  const obsCsrfCookie = add('observation', T.obsCsrfCookie[0], '-d', T.obsCsrfCookie[1], '--at', 'src/middleware/session.ts:19', '--status', 'confirmed');
  link(obsCsrfCookie, hyCsrf, 'contradicts', T.lblCsrfCounter);

  // Audit dossier associations: explicit issue membership and necessary conditions.
  const condAuth = add('condition', T.condAuth[0], '-d', T.condAuth[1], '--at', 'src/routes/admin/index.ts:28');
  const condTenant = add('condition', T.condTenant[0], '-d', T.condTenant[1], '--at', 'src/routes/admin/export.ts:104');
  const condTrigger = add('condition', T.condTrigger[0], '-d', T.condTrigger[1], '--at', 'src/routes/upload.ts:87');
  link(fdAuth, goalAuth, 'answers', T.lblAuthAnswer);
  link(hyAuth, goalAuth, 'answers', T.lblHyAuthAnswer);
  link(fdAuth, condAuth, 'depends-on', T.lblCondAuth);
  link(fdExport, goalTenant, 'answers', T.lblExportAnswer);
  link(fdExport, condTenant, 'depends-on', T.lblCondTenant);
  link(hyFiles, goalTenant, 'answers', T.lblHyFilesAnswer);
  link(fdFiles, goalTenant, 'answers', T.lblFilesAnswer);
  link(fdFiles, condTenant, 'depends-on', T.lblCondTenant);
  link(qUpload, condTrigger, 'depends-on', T.lblCondTrigger);

  // Populate the isolated Ultra slice & probe ledger (.pinwhy/ultra/ledger.jsonl).
  const U = T.ultra;
  const synced = JSON.parse(ultra('sync', '--json'));
  const byPath = new Map(synced.snapshot.slices.map((s) => [s.path, s.id]));

  ultra('exclude', byPath.get('scripts/seed-fixtures.ts'), '--note', U.excludeNote, '--json');
  ultra('done', byPath.get('src/middleware/session.ts'), '--note', U.notes.session, '--refs', obsCsrfCookie, '--json');
  ultra('done', byPath.get('src/routes/admin/index.ts'), '--note', U.notes.index, '--refs', `${hyAuth},${fRouter},${condAuth}`, '--json');
  ultra('done', byPath.get('src/routes/admin/users.ts'), '--note', U.notes.users, '--depends-on', 'src/routes/admin/index.ts', '--refs', `${fdAuth},${obsUsers}`, '--json');
  ultra('done', byPath.get('src/routes/admin/write.ts'), '--note', U.notes.write, '--depends-on', 'src/routes/admin/index.ts', '--refs', obsWrite, '--status', 'cleared', '--json');
  ultra('done', byPath.get('src/routes/admin/roles.ts'), '--note', U.notes.roles, '--depends-on', 'src/middleware/session.ts', '--refs', `${hyCsrf},${obsCsrf}`, '--json');
  ultra('done', byPath.get('src/routes/admin/export.ts'), '--note', U.notes.exportRoute, '--depends-on', 'src/middleware/session.ts', '--refs', `${fdExport},${obsExport},${condTenant}`, '--json');
  ultra('done', byPath.get('src/routes/upload.ts'), '--note', U.notes.upload, '--refs', `${qUpload},${obsSvg},${counter},${condTrigger}`, '--json');
  ultra('done', byPath.get('src/jobs/export-worker.ts'), '--note', U.notes.worker, '--depends-on', 'src/routes/admin/export.ts', '--refs', `${fdFiles},${hyFiles},${obsJob}`, '--json');

  const p1 = JSON.parse(ultra('add', U.probes.adminProbe, '--sector', 'src/routes', '--at', 'src/routes/admin/users.ts:42', '--depends-on', 'src/routes/admin/index.ts', '--json')).added[0].id;
  ultra('done', p1, '--note', U.probeNotes.adminProbe, '--refs', `${fdAuth},${obsUsers}`, '--json');

  const p2 = JSON.parse(ultra('add', U.probes.exportHeaderProbe, '--sector', 'src/jobs', '--at', 'src/jobs/export-worker.ts:64', '--depends-on', 'src/routes/admin/export.ts', '--json')).added[0].id;
  ultra('done', p2, '--note', U.probeNotes.exportHeaderProbe, '--status', 'cleared', '--json');

  ultra('add', U.probes.billingReplayProbe, '--sector', 'src/billing', '--at', 'src/billing/invoice.ts:12', '--json');

  bb('checkpoint', '--summary', T.cp2, ...R);
  return { dir, bb };
}

function build(lang) {
  const { dir, bb } = createDemoDir(lang);
  try {
    const out = path.join(OUT, `board-${lang}.html`);
    bb('export', '--out', out);
    const html = fs.readFileSync(out, 'utf8');
    if (html.includes(os.homedir()) || html.includes(dir)) throw new Error(`${out} contains a local path`);
    if (!html.includes('window.__PINWHY_ULTRA__')) throw new Error(`${out} is missing Ultra snapshot payload`);
    console.log(`exported ${path.relative(REPO, out)} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(path.join(OUT, 'board.html'), { force: true });
  build('zh');
  build('en');
}
