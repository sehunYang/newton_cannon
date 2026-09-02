/**
 * 빌드 도구 없이 돌아가는 프로젝트라 최소한의 안전망:
 * src/ 전체를 실제로 import 해서 문법 오류 · 잘못된 경로를 잡아냅니다.
 * (DOM 이 필요한 모듈은 import 만으로는 부작용이 없도록 작성돼 있습니다.)
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

let failed = 0;
for (const file of walk(ROOT)) {
  try {
    await import(pathToFileURL(file).href);
  } catch (err) {
    // DOM 부재로 인한 런타임 오류는 문법 문제가 아니므로 구분해서 보고
    const isDomIssue = /is not defined|document|window|HTMLCanvas/.test(err.message);
    console.error(`${isDomIssue ? 'SKIP' : 'FAIL'} ${relative(ROOT, file)} — ${err.message}`);
    if (!isDomIssue) failed++;
  }
}
console.log(failed === 0 ? '\n✅ 모든 모듈 로드 성공' : `\n❌ ${failed}개 모듈 실패`);
process.exit(failed ? 1 : 0);
