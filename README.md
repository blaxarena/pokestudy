# 포켓몬 학습기

v10의 학습 기능을 유지하면서, 직접 배치한 49개 에셋으로 만든 숲속에서 숨은 포켓몬을 찾는 학습기입니다.

[내 숲속 숨은 포켓몬 찾기](https://blaxarena.github.io/pokestudy/?play=forest)에서 난이도를 고르고 시작하세요. 배경과 에셋 배치는 고정되며 포켓몬의 종류와 은신 위치가 바뀝니다.

## 설치 없이 웹에서 실행하기

GitHub Pages 배포가 완료되면 `https://blaxarena.github.io/pokestudy/`에서 실행합니다. PC나 태블릿에 Python을 설치할 필요가 없습니다.

최초 한 번 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택하세요. 이후 **Actions → Deploy learning app to GitHub Pages → Run workflow**에서 `main`을 선택해 실행합니다. Pages가 아직 켜지지 않은 상태에서 실패한 실행은 활성화 후 다시 실행하면 됩니다. 배포 작업이 성공한 뒤 웹 주소로 접속하세요. 저장소 요금제/공개 범위에 따라 Pages 사용 가능 여부가 달라질 수 있습니다.

이후 main 변경 시 `.github/workflows/pages.yml`이 자동 테스트 후 웹 파일만 배포합니다. 테스트 fixture와 개발 문서는 배포물에서 제외합니다. 배포 주소에서는 HTTPS로 외부 PokéAPI/이미지 서버에 직접 접속합니다.

## 실행

Node 24 및 Python 3 환경에서 `/workspace/pokestudy`로 이동해 `npm start`를 실행합니다. 별도 앱 패키지 설치나 빌드 과정은 없습니다. HTTP 서버의 8000번 포트로 접속하세요. `file://`는 ES 모듈과 JSON 로드 제약으로 지원하지 않습니다.
인터넷이 필요합니다: `pokeapi.co`(세대·한국어 이름·종 정보), `raw.githubusercontent.com`(캐릭터 이미지).

## 구조와 자산 교체

- `index.html`: 기존 이름 퀴즈·색칠·이름 쓰기와 숨은그림찾기 UI
- `src/modules/hidden-picture/`: 사용자 배치 로더·레이어 합성·가림 분석·포켓몬 배치·터치 판정
- `public/assets/forest/scene-01/forest-layout.json`: 업로드한 49개 에셋 배치 원본
- 같은 폴더 `scene-layout-v1.json`: 원본 배치와 에셋 manifest 해시, 난이도별 은신 위치 24세트씩
- `asset-packages/forest-01/`: 오브젝트 없는 기본 배경과 독립 PNG·자산 메타데이터
- `scripts/build_forest_slots.py`: 배치 변경 후 은신 위치를 재생성하는 개발용 도구(Pillow·NumPy 필요)

배치의 x/y는 투명 여백을 제외한 그림의 왼쪽 위 정규화 좌표이며 width는 장면 너비에 대한 비율입니다. crop·뒤집기·진하기·숨김·앞뒤 순서를 편집기와 동일하게 적용합니다. 포켓몬은 이 레이어 사이에 들어가고 정답 원은 항상 최상단에 표시합니다. 예전 `scene.json`과 옛 PNG는 이 숲속 게임에서 사용하지 않습니다.

가림 후보는 PNG 알파를 분석해 미리 생성하고, 실행 시 실제 포켓몬 그림의 알파를 다시 확인합니다. 투명한 그림 여백은 가림 비율 계산에서 제외합니다. 전체 가림 상한은 쉬움 22%, 보통 32%, 어려움 42%이며 상단의 가림도 별도로 제한합니다. 위치 충돌·화면 이탈이 없는 세트에서 매번 무작위로 선택합니다. 원본은 1672×941이며 4K 화면에서는 확대 표시됩니다.

배치나 asset manifest를 바꾸면 `python scripts/build_forest_slots.py`로 후보를 다시 만들고 검증하세요. 앱 사용과 GitHub Pages 배포에는 Python이나 이 재생성 과정이 필요하지 않습니다.

## 검증

`npm test`: 28개 검사. 편집기 모델, 기존 배치·좌표 판정, 사용자 배치 무결성, 난이도별 24개 세트의 개수·겹침·이탈·가림·참조 검사와 무작위 배치를 포함합니다.
`python tests/user_forest_browser.py`: 편집기/게임의 배경 합성 픽셀 일치, 원본 레이어 순서와 실제 스프라이트 알파 기준 가림 상한을 검사합니다. API 요청은 fixture로 대체합니다.
`python tests/browser_smoke.py`: HTTP 서버, Python Playwright, `/usr/bin/chromium`, 테스트용 PNG(`tests/fixtures/bulbasaur.png`, PokéAPI sprites 출처)를 사용합니다. 필요하면 `TEST_SPRITE`로 경로를 바꿀 수 있습니다. 외부 요청을 fixture로 대체해 테스트하며 실제 API나 그림 품질 검증을 뜻하지 않습니다. 테스트의 '테스트1' 등 이름과 공용 이미지는 제품에 저장되지 않습니다.

앱에는 테스트용 데이터나 가짜 포켓몬이 포함되지 않습니다. 실제 실행은 PokéAPI를 사용하며 데이터/이미지 실패 시 안내 후 재시도합니다.

## 알려진 제한

숲속은 독립 에셋을 사용합니다. 생성 이미지의 미세 외곽 품질과 종별 얼굴 식별성은 실제 플레이에서 추가 검토할 수 있습니다. 세 학습 모듈은 원본 스크립트를 보존하고 주요 입력·저장 흐름을 fixture로 검증했습니다. iPad Safari·Android 실기기와 한국어 TTS는 별도 확인이 필요합니다. 최초 후보는 1~9세대 중 150종을 무작위 표본 추출하고 이후 브라우저에 캐시하는 기존 동작을 유지합니다.

## 사용자 배치 적용

공개 게임에는 업로드한 `forest-layout.json`의 49개 오브젝트를 그대로 적용했습니다. 에셋 편집기에서 이후 수정한 로컬 배치는 공개 게임에 자동 반영되지 않습니다. 수정 파일을 내보내 프로젝트의 배치를 갱신해야 합니다.

## 독립 그래픽 에셋 패키지

새로 제작한 숲속 에셋은 `asset-packages/forest-01/`에 별도로 보관합니다. [에셋 갤러리](https://blaxarena.github.io/pokestudy/asset-packages/forest-01/)에서 투명 영역의 표시색을 바꿔 개별 PNG를 확인할 수 있습니다. 이 패키지는 기존 게임 장면을 자동 교체하지 않습니다.

## 직접 배치 편집기

[숲속 장면 만들기](https://blaxarena.github.io/pokestudy/editor/)에서 에셋을 클릭하거나 배경으로 끌어 추가하고, 손가락/마우스로 위치를 바꿀 수 있습니다. 선택한 에셋의 오른쪽 아래 모서리 또는 크기 슬라이더로 크기를 조절합니다. 좌우 뒤집기, 진하기, 숨기기, 앞뒤 순서, 복제/삭제, 되돌리기를 지원합니다.

배치는 현재 브라우저에 자동 저장됩니다. **배치 JSON 저장**으로 파일을 보관하고 **배치 JSON 불러오기**로 다른 기기에서도 이어 편집하세요. **완성 이미지 PNG 저장**은 선택 테두리 없이 1672×941 이미지로 저장합니다. 이 편집기는 배치 시안 제작용이며, 공개 숨은그림찾기 장면을 자동 교체하지 않습니다.

`npm test`는 편집기·게임 관련 검사 28개를 실행합니다. `python tests/editor_browser.py`는 실제 에셋을 사용해 PC/터치·파일 저장/복원을 검사하며 Python Playwright, Pillow, 시스템 Chromium이 필요합니다. 일반 사용자는 설치 없이 위 웹 주소로 이용할 수 있습니다.
