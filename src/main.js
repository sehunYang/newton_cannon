/**
 * 엔트리포인트.
 *
 * 빌드 도구 없이 네이티브 ES 모듈로 동작합니다.
 * 다만 브라우저 보안 정책상 file:// 로 직접 열면 모듈을 못 불러오므로
 * 반드시 로컬 서버로 여세요:  npm run dev   (또는 VS Code Live Server)
 */
import { App } from './app/App.js';
import { els } from './ui/dom.js';

const app = new App(els.canvas());
app.start();

// 개발 중 콘솔에서 상태를 들여다볼 수 있게 열어둡니다
window.__cannon = app;
