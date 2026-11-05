# 포켓몬 학습기

v10의 학습 기능을 보존하며 숲속 1장 레이어 엔진을 분리한 플레이 가능 시제품입니다.
**최종 숲속 아트는 미완료입니다.** 기존 배경에 주요 자연물이 합성되어 있으며 기존 추출 PNG는 현재 장면에서 제외했습니다. 새 투명 수풀을 세 곳에만 배치합니다.

## 설치 없이 웹에서 실행하기

GitHub Pages 배포가 완료되면 `https://blaxarena.github.io/pokestudy/`에서 실행합니다. PC나 태블릿에 Python을 설치할 필요가 없습니다.

최초 한 번 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택하세요. 이후 **Actions → Deploy learning app to GitHub Pages → Run workflow**에서 `main`을 선택해 실행합니다. Pages가 아직 켜지지 않은 상태에서 실패한 실행은 활성화 후 다시 실행하면 됩니다. 배포 작업이 성공한 뒤 웹 주소로 접속하세요. 저장소 요금제/공개 범위에 따라 Pages 사용 가능 여부가 달라질 수 있습니다.

이후 main 변경 시 `.github/workflows/pages.yml`이 자동 테스트 후 웹 파일만 배포합니다. 테스트 fixture와 개발 문서는 배포물에서 제외합니다. 배포 주소에서는 HTTPS로 외부 PokéAPI/이미지 서버에 직접 접속합니다.

## 실행

Node 24 및 Python 3 환경에서 `/workspace/pokestudy`로 이동해 `npm start`를 실행합니다. 별도 앱 패키지 설치나 빌드 과정은 없습니다. HTTP 서버의 8000번 포트로 접속하세요. `file://`는 ES 모듈과 JSON 로드 제약으로 지원하지 않습니다.
인터넷이 필요합니다: `pokeapi.co`(세대·한국어 이름·종 정보), `raw.githubusercontent.com`(캐릭터 이미지).

## 구조와 자산 교체

- `index.html`: 기존 퀴즈·색칠·쓰기 UI와 스크립트
- `src/modules/hidden-picture/`: 렌더링/장면 로더/배치/별도 터치 판정
- `public/assets/forest/scene-01/scene.json`: 정규화된 장면 정의
- 같은 폴더 `objects/`: 제공된 독립 PNG, `manifest.json`: 출처·해상도·QA 상태
- `docs/development-plan.md`: 기능 분석·단계별 계획·미충족 인수 기준

오브젝트의 x는 중심, y는 위쪽 기준이며 width는 장면 너비 비율입니다. scale은 width에 곱해집니다. zIndex 0~49는 후면, 50~999는 전면입니다. `hidden:true`로 끄고 x/y를 변경해 이동할 수 있습니다. 정답 원은 모든 오브젝트 위에 그립니다. 슬롯 x/y는 포켓몬 중심입니다. foregroundObjectIds는 해당 가림 오브젝트와 연결되며 maxOcclusionRatio는 현재 설계 상한입니다. 알파 기반 가림 비율 자동 검증은 아직 없습니다. 최종 아트 배치 때 실제 가림을 재측정해야 합니다.

새 배경을 넣을 때 `scene.json`의 background와 엔진의 FOREST_BG 경로를 함께 바꿀 필요가 없도록 로더 기준으로 로드합니다. 일러스트에서 임의로 오려낸 패치를 최종 레이어로 교체하지 마세요. 기존 foreground 파일은 사용하지 않습니다. 투명 PNG 검증만으로 경계 품질을 보증할 수 없습니다.

## 검증

`npm test`: 9개 검사. 난이도별 100회 배치의 개수/고유 슬롯/겹침/이탈, 중복 종 거부, 슬롯 가림 연결, 4개 화면 크기 좌표 판정.
`python tests/browser_smoke.py`: HTTP 서버, Python Playwright, `/usr/bin/chromium`, 테스트용 PNG(`tests/fixtures/bulbasaur.png`, PokéAPI sprites 출처)를 사용합니다. 필요하면 `TEST_SPRITE`로 경로를 바꿀 수 있습니다. 외부 요청을 fixture로 대체해 테스트하며 실제 API나 그림 품질 검증을 뜻하지 않습니다. 테스트의 '테스트1' 등 이름과 공용 이미지는 제품에 저장되지 않습니다.

앱에는 테스트용 데이터나 가짜 포켓몬이 포함되지 않습니다. 실제 실행은 PokéAPI를 사용하며 데이터/이미지 실패 시 안내 후 재시도합니다.

## 알려진 제한

모든 주요 가림 오브젝트의 완전한 분리, 자연스러운 은신 위치, 네이티브 4K 아트는 추가 자산이 필요합니다. 세 학습 모듈은 원본 스크립트 동일성을 확인했지만 모든 입력/다운로드의 기기별 회귀를 검증하지는 않았습니다. iPad Safari·Android 실기기와 한국어 TTS는 별도 확인이 필요합니다. 최초 후보는 1~9세대 중 150종을 무작위 표본 추출하고 이후 브라우저에 캐시하는 기존 동작을 유지합니다.

## 장면 정리

반복 배치된 47개 레이어를 제거하고, 투명 배경을 검수한 독립 수풀을 3곳에만 둡니다. 기존 추출 PNG는 참고용으로 보존하지만 장면에서 불러오지 않습니다. 포켓몬 수와 목표 수는 유지합니다. 배경 자체에 합성된 나무·바위는 여전히 분리 과제로 남아 있습니다.

## 독립 그래픽 에셋 패키지

새로 제작한 숲속 에셋은 `asset-packages/forest-01/`에 별도로 보관합니다. [에셋 갤러리](https://blaxarena.github.io/pokestudy/asset-packages/forest-01/)에서 투명 영역의 표시색을 바꿔 개별 PNG를 확인할 수 있습니다. 이 패키지는 기존 게임 장면을 자동 교체하지 않습니다.
