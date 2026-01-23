# Inpainting Pipeline v5 Changelog

버전: v5.0 (CLIP Blending 지원)
작성일: 2026-01-19
작성자: Claude Code

---

## 1. 변경 개요

v4에서 발견된 **Dual IP-Adapter 차원 불일치 문제**를 해결하기 위해 CLIP Blending 모드를 추가했다.

### 문제 상황 (v4)

Dual IP-Adapter (FaceID + Standard CLIP) 시도 시 차원 불일치 에러 발생:

```
RuntimeError: linear(): input and weight.T shapes cannot be multiplied (257x1664 and 512x1024)
```

**원인 분석:**
- FaceID: InsightFace 512-dim 임베딩
- Standard: CLIP 1664-dim 임베딩 (OpenCLIP BigG)
- diffusers가 두 다른 차원의 임베딩을 동시 처리 불가

### 해결책: CLIP Blending 모드

CLIP 임베딩 직접 블렌딩 대신 **픽셀 레벨 블렌딩** 방식 채택:

1. BiSeNet으로 머리카락 영역 추출
2. 얼굴 + 머리카락 영역을 가중치로 픽셀 블렌딩
3. 합성된 이미지를 Standard IP-Adapter에 전달
4. CLIP이 합성 이미지에서 얼굴+머리카락 특성 추출

---

## 2. 새로운 기능

### 2.1 CLIP Blending 모드 (`--use-clip-blend`)

```bash
python inpainting-pipeline.py reference.png face.png \
    --use-clip-blend \
    --face-blend-weight 0.6 \
    --hair-blend-weight 0.4 \
    --face-strength 0.65 \
    --denoising 0.68 \
    -o output.png
```

**새 파라미터:**
| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `--use-clip-blend` | False | CLIP Blending 모드 활성화 |
| `--face-blend-weight` | 0.6 | 얼굴 영역 블렌딩 가중치 |
| `--hair-blend-weight` | 0.4 | 머리카락 영역 블렌딩 가중치 |

### 2.2 픽셀 레벨 블렌딩 로직

```python
def _create_face_hair_composite(self, source_face, hair_region,
                                 face_weight=0.6, hair_weight=0.4):
    # 머리카락 마스크 생성 (BiSeNet 출력 기반)
    hair_mask = np.any(np.abs(hair_array - 128) > 20, axis=2)

    # 가중치 블렌딩
    blended = face_array * (1 - hair_mask * hair_w) + hair_array * (hair_mask * hair_w)

    return Image.fromarray(blended)
```

---

## 3. 실험 결과

### 3.1 테스트 환경

- 디바이스: Mac M3 (MPS)
- 모델: SDXL Inpainting 0.1
- IP-Adapter: Standard (h94/IP-Adapter)
- 테스트 이미지: reference-image.png, face-image.png

### 3.2 실험 파라미터 비교

| 실험 | 모드 | face_strength | denoising | guidance | face:hair 비율 | 결과 |
|------|------|---------------|-----------|----------|----------------|------|
| baseline | CLIP Blend | 0.65 | 0.68 | 4.5 | 60:40 | 기준선 |
| exp1 | CLIP Blend | 0.75 | 0.68 | 4.5 | 50:50 | 머리카락 더 반영 |
| exp2 | CLIP Blend | 0.70 | 0.75 | 5.0 | 40:60 | 머리카락 강조 |
| compare | FaceID | 0.65 | 0.68 | 4.5 | N/A | 얼굴만 보존 |

### 3.3 권장 파라미터

**얼굴 유사성 우선:**
```bash
--use-clip-blend --face-strength 0.65 --denoising 0.68 --guidance 4.5 \
--face-blend-weight 0.6 --hair-blend-weight 0.4
```

**머리카락 스타일 강조:**
```bash
--use-clip-blend --face-strength 0.70 --denoising 0.75 --guidance 5.0 \
--face-blend-weight 0.4 --hair-blend-weight 0.6
```

**균형 (권장):**
```bash
--use-clip-blend --face-strength 0.70 --denoising 0.70 --guidance 4.5 \
--face-blend-weight 0.5 --hair-blend-weight 0.5
```

---

## 4. 모드 비교

| 모드 | 얼굴 정체성 | 머리카락 스타일 | 속도 | 추가 의존성 |
|------|-------------|-----------------|------|-------------|
| Standard | 낮음 (CLIP) | X | 빠름 | 없음 |
| FaceID | 높음 (InsightFace) | X | 빠름 | insightface |
| CLIP Blend | 중간 (CLIP) | O (픽셀 블렌딩) | 빠름 | 없음 |
| Dual (v4) | - | - | - | 동작 안함 |

### 권장 사용 시나리오

- **얼굴 정체성 중요**: `--use-faceid`
- **머리카락 스타일 전이**: `--use-clip-blend --hair-blend-weight 0.6`
- **균형**: `--use-clip-blend`

---

## 5. 중간 결과 파일

`--save-mask` 옵션 사용 시 CLIP Blending 모드에서 생성되는 파일:

| 번호 | 파일명 | 설명 |
|------|--------|------|
| 0 | `*_0_background.png` | 배경 이미지 |
| 1 | `*_1_mask.png` | 마스크 |
| 2 | `*_2_mask_overlay.png` | 마스크 오버레이 |
| 3 | `*_3_inpaint_input.png` | Inpainting 입력 |
| 4 | `*_4_source_face.png` | 원본 얼굴 |
| 5 | `*_5_hair_region.png` | 머리카락 영역 |
| 6 | `*_6_mask_contour.png` | 마스크 윤곽선 |
| 7 | `*_7_clip_blend_info.txt` | CLIP Blend 정보 |
| 8 | `*_8_composite_input.png` | 합성 입력 이미지 (NEW) |
| 9 | `*_9_hair_input.png` | 머리카락 입력 |

---

## 6. 한계점

1. **CLIP 임베딩 직접 블렌딩 미지원**: IP-Adapter projection layer 호환성 문제
2. **머리카락 영역 의존성**: BiSeNet 머리카락 추출 품질에 따라 결과 변동
3. **픽셀 블렌딩 한계**: 미세한 머리카락 디테일은 손실 가능

---

## 7. 향후 개선 계획

1. **InstantID 통합**: ControlNet + IP-Adapter 조합으로 더 정확한 얼굴 전이
2. **HairFusion 통합**: 전용 헤어스타일 전이 모델 적용
3. **Hyper-SD/LCM LoRA**: 속도 개선 (50 steps -> 4 steps)

---

*Inpainting Pipeline v5.0 - CLIP Blending Support*
*FastFace Project*
