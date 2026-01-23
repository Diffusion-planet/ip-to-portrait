# Changelog v6 - Advanced Control Features

## Overview

v6에서는 생성 품질을 세밀하게 제어하는 기능과 자동화 기능이 추가되었다.

---

## New Features

### 1. Neck Masking (`--include-neck`)

BiSeNet의 목 영역(클래스 14)을 마스크에 포함하는 옵션.

**사용 시점:**

- 레퍼런스 이미지의 목이 이상하거나 두꺼울 때
- 얼굴과 목의 피부톤이 다를 때

**사용법:**

```bash
python inpainting-pipeline.py ref.png face.png --use-faceid-plus --include-neck
```

**구현:**

- `face_parsing.py`에 `BISENET_NECK_LABELS = [14]` 추가
- `get_face_hair_mask()`에 `include_neck` 파라미터 추가

---

### 2. Stop-At (`--stop-at`)

생성 과정 중 FaceID 적용을 중단하는 시점을 제어.

**원리:**

```
[생성 스텝]  0% -------- 70% -------- 100%
[FaceID]    ON --------- OFF -------- OFF   (stop-at=0.7)
```

- 초반 (0~70%): 얼굴 구조와 정체성 확립 (FaceID 적용)
- 후반 (70~100%): 디테일과 품질 다듬기 (FaceID 해제)

**효과:**

- 얼굴 왜곡 감소 (입이 찌그러지는 현상 완화)
- 더 자연스러운 결과물
- 정체성은 유지하면서 품질 향상

**사용법:**

```bash
# 70%까지만 FaceID 적용 (권장)
python inpainting-pipeline.py ref.png face.png --use-faceid-plus --stop-at 0.7

# 50%까지만 적용 (왜곡 심할 때)
python inpainting-pipeline.py ref.png face.png --use-faceid-plus --stop-at 0.5
```

**구현:**

- `callback_on_step_end`를 사용한 스텝별 콜백
- 진행률에 따라 `set_ip_adapter_scale(0.0)` 호출

---

### 3. Auto Prompt (`--auto-prompt`)

Gemini Vision API로 얼굴 이미지를 분석하여 프롬프트 자동 생성.

**분석 항목:**

- 나이/성별 (young woman in her 20s, middle-aged man)
- 인종/민족 (Korean, East Asian, Caucasian)
- 피부톤 (fair skin, medium skin tone)
- 얼굴 구조 (soft features, sharp jawline)
- 전체 인상 (youthful, professional, approachable)

**설정:**

1. `.env` 파일 생성:

```
GEMINI_API_KEY=your_api_key_here
```

2. 명령어 실행:

```bash
python inpainting-pipeline.py ref.png face.png --use-faceid-plus --auto-prompt
```

**출력 예시:**

```
young Korean woman in her 20s, fair skin, soft facial features,
delicate bone structure, youthful appearance, radiant complexion,
natural beauty, dark hair, warm and approachable demeanor
```

**구현:**

- `prompt_generator.py` 모듈 분리
- `.env` 파일로 API 키 관리 (gitignore 처리)

---

### 4. Aspect Ratio Preservation

원본 얼굴 이미지의 비율을 유지하면서 배경을 Center Crop.

**기존 동작:**

- 배경 이미지 비율 유지
- 얼굴 이미지와 비율 불일치 가능

**v6 동작:**

- 얼굴 이미지 비율 기준으로 최종 크기 결정
- 배경 이미지를 Center Crop 후 리사이즈
- `ImageOps.fit()` 사용

---

### 5. Verbose Step Logging

생성 과정을 실시간으로 확인할 수 있는 상세 로그.

**출력 예시:**

```
🎨 생성 시작... (총 50 스텝, Stop-at: 70%)
   [Step 01/50] 진행률 2% -> FaceID: ✅ ON  (Scale: 0.8)
   [Step 02/50] 진행률 4% -> FaceID: ✅ ON  (Scale: 0.8)
   ...
   [Step 35/50] 진행률 70% -> FaceID: ✅ ON  (Scale: 0.8)
   [Step 36/50] 진행률 72% -> FaceID: 🛑 OFF (Scale: 0.0)
   ...
```

---

## File Changes

### New Files

| 파일 | 설명 |
|------|------|
| `prompt_generator.py` | Gemini Vision 프롬프트 생성 모듈 |
| `.env-example` | API 키 템플릿 |

### Modified Files

| 파일 | 변경 내용 |
|------|----------|
| `inpainting-pipeline.py` | stop-at, auto-prompt, aspect ratio 기능 추가 |
| `face_parsing.py` | include_neck 파라미터 추가 |
| `.gitignore` | .env 추가 |
| `README.md` | 신기능 문서화 |

---

## Parameter Reference

### 신규 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `--include-neck` | flag | false | 목 영역 마스킹 포함 |
| `--stop-at` | float | 1.0 | FaceID 적용 중단 시점 (0.0~1.0) |
| `--auto-prompt` | flag | false | Gemini 프롬프트 자동 생성 |

### 권장 조합

```bash
# 표준 고품질 설정
python inpainting-pipeline.py ref.png face.png \
    --use-faceid-plus \
    --face-strength 0.80 \
    --denoising 0.85 \
    --stop-at 0.7 \
    --auto-prompt \
    -o output

# 목까지 포함 (레퍼런스 목 문제 시)
python inpainting-pipeline.py ref.png face.png \
    --use-faceid-plus \
    --include-neck \
    --stop-at 0.7 \
    --auto-prompt \
    -o output
```

---

## Migration from v5

v5에서 v6로 마이그레이션 시 변경 사항:

1. **기본 동작 변경 없음**: 기존 명령어 그대로 동작
2. **신규 옵션 추가**: 선택적으로 사용 가능
3. **API 키 설정**: auto-prompt 사용 시 `.env` 파일 필요

---

## Known Issues

- `--stop-at` 값이 너무 낮으면 (0.3 이하) 정체성 보존 약화
- `--auto-prompt`는 네트워크 연결 필요 (Gemini API 호출)
- 일부 얼굴에서 Gemini 분석 실패 시 기본 프롬프트 사용
