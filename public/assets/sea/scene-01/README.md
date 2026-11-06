# 고래왕 섬 · 사용자 고정 배치

`sea-wailord-layout.json`은 업로드한 원본 JSON을 그대로 보관한 파일입니다. 75개 에셋의 위치·크기·레이어·좌우 뒤집기·진하기를 고정하며, 일반 물고기 장식은 포켓몬 정답에 포함하지 않습니다.

`scene-layout-v1.json`은 배치와 에셋의 알파값을 분석해 만든 난이도별 24가지 은신 위치입니다. 원본 배치는 유지하고 포켓몬 위치만 달라집니다. 에셋은 `asset-packages/sea-wailord-01/manifest.json`을 참조합니다.

재계산: `python scripts/build_forest_slots.py --scene sea` (개발용 Pillow, NumPy 필요).
