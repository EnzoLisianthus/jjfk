# JJFK v1 Migration Shell

이 저장소는 기존 JJFK v1 설치 사용자를 새로운 JJFK로 안내하기 위한 migration 전용 버전입니다.

## 새 버전 URL 설정

`index.html`에서 아래 한 줄만 수정하세요.

```js
const NEW_APP_URL = "";
```

예:

```js
const NEW_APP_URL = "https://example.com/new-jjfk/";
```

가능하면 **기존 PWA의 scope 밖에 있는 HTTPS URL**을 사용하세요. iOS Standalone PWA에서 버튼은 `_blank` 외부 링크로 열리도록 되어 있어, 새 주소가 기존 scope 밖이면 Safari로 전달되는 동작이 가장 안정적입니다.

## 기존 설치 사용자 갱신

새 `service-worker.js`는:

- `jjfk-cache-*` 계열의 기존 캐시를 제거합니다.
- 새 migration 화면을 확보한 후에만 기존 캐시를 삭제합니다.
- `skipWaiting()` + `clients.claim()`으로 새 SW를 빠르게 활성화합니다.
- 이미 열려 있는 구버전 창도 가능한 경우 migration URL로 이동시킵니다.
- 이후 navigation은 network-first로 새 `index.html`을 우선 확인합니다.

브라우저/iOS의 Service Worker 업데이트 확인 시점 때문에 **오프라인 상태나 OS가 업데이트 확인을 아직 수행하지 않은 순간까지 100% 즉시 강제할 수는 없습니다.** 하지만 사용자가 온라인 상태에서 기존 PWA를 다시 실행하면 새 SW가 감지되는 즉시 안내 화면으로 전환되도록 구성되어 있습니다.

## 홈 화면 설치 유도

iOS 웹에서는 `홈 화면에 추가`를 JavaScript로 직접 실행하는 공개 API가 없습니다. 따라서 안내 화면에 다음 절차를 표시합니다.

1. 새 버전을 Safari에서 열기
2. 공유 버튼
3. 홈 화면에 추가
