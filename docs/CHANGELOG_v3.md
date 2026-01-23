# Inpainting Pipeline v3 Changelog

버전: v3.1 (FaceID 지원 - 수정)
작성일: 2026-01-18
작성자: Claude Code

---

## 1. 변경 개요

v2에서 발견된 **얼굴 정체성 미보존 문제**를 해결하기 위해 IP-Adapter FaceID 지원을 추가했다.

### 문제 상황 (v2)

테스트 결과, Standard IP-Adapter로 생성된 얼굴이 입력 얼굴과 다른 사람처럼 보이는 문제 발생.

```
입력: 이성민 얼굴
출력: "비슷한 분위기의 다른 동양인 남성"
```

**원인 분석:**
- Standard IP-Adapter는 CLIP 임베딩만 사용
- CLIP은 이미지의 "시맨틱"을 캡처 (동양인, 남성, 검은 머리 등)
- 구체적인 얼굴 특징 (눈 모양, 코 높이, 얼굴 비율)은 손실됨

### 중요: FaceID Plus v2 vs non-Plus FaceID

초기에는 FaceID Plus v2 (`ip-adapter-faceid-plusv2_sdxl.bin`)를 적용하려 했으나,
**diffusers 라이브러리 한계**로 인해 non-Plus FaceID로 변경.

**Plus v2 사용 불가 원인:**
1. FaceID Plus v2는 InsightFace 임베딩 + CLIP 이미지 임베딩 **둘 다** 필요
2. diffusers의 `load_ip_adapter()`는 `ip_adapter_image` 또는 `ip_adapter_image_embeds` 중 **하나만** 허용
3. 두 파라미터를 동시에 전달하면 `ValueError` 발생
4. Plus v2 내부에서 `self.clip_embeds`가 None으로 남아 `AttributeError` 발생

**최종 해결책: non-Plus FaceID 사용**
- `ip-adapter-faceid_sdxl.bin`: InsightFace 512-dim 임베딩**만** 사용
- CLIP 인코더 불필요 (`image_encoder_folder=None`)
- diffusers 표준 인터페이스와 완전 호환

---

## 2. 변경 내역

### 2.1 새로 생성된 파일

#### face_id.py

| 항목 | 내용 |
|------|------|
| 목적 | InsightFace 기반 얼굴 임베딩 추출 모듈 |
| 주요 클래스 | `FaceIDExtractor`, `FaceIDIPAdapter` |
| 의존성 | `insightface`, `onnxruntime` |

**핵심 메서드:**

```python
class FaceIDExtractor:
    def get_embedding_for_ip_adapter(
        self, image, dtype=torch.float16, device=None
    ) -> Optional[torch.Tensor]:
        """
        InsightFace로 512차원 얼굴 임베딩 추출
        IP-Adapter FaceID 입력 형식으로 반환
        """
```

**변경 이유:**
- InsightFace는 얼굴 인식에 특화된 512차원 임베딩 생성
- CLIP의 시맨틱 임베딩보다 훨씬 정확한 얼굴 특징 캡처
- IP-Adapter FaceID와 호환되는 형식 필요

---

#### LIMITATIONS.md

| 항목 | 내용 |
|------|------|
| 목적 | Inpainting Pipeline의 한계점 및 개선 방향 문서화 |
| 내용 | 정체성 미보존, 머리카락 스타일 미전이, 느린 생성 속도 등 |

---

### 2.2 수정된 파일

#### inpainting-pipeline.py

**변경 1: FaceID 모듈 import 추가**

```python
# Before (v2)
# FaceID 관련 코드 없음

# After (v3)
try:
    from face_id import FaceIDExtractor, FaceIDIPAdapter, check_insightface_available
    HAS_FACEID = check_insightface_available()
    if not HAS_FACEID:
        print("InsightFace not installed. FaceID mode unavailable.")
except ImportError:
    HAS_FACEID = False
```

---

**변경 2: __init__에 use_faceid 파라미터 추가**

```python
# Before (v2)
def __init__(self, detection_method='opencv', use_bisenet=True):

# After (v3)
def __init__(self, detection_method='opencv', use_bisenet=True, use_faceid=False):
    # ...
    self.use_faceid = use_faceid and HAS_FACEID
    self.ip_adapter_mode = "faceid" if self.use_faceid else "standard"

    # FaceID extractor 초기화
    if self.use_faceid:
        self.face_id_extractor = FaceIDExtractor(device=self.device)
        self.face_id_extractor.load()
```

---

**변경 3: _load_ip_adapter() 메서드 - non-Plus FaceID 사용**

```python
def _load_ip_adapter(self) -> bool:
    if self.use_faceid:
        # FaceID (non-Plus): InsightFace 임베딩만 사용
        # Plus v2는 diffusers에서 제대로 지원되지 않음 (CLIP+InsightFace 둘 다 필요)
        print(f"IP-Adapter FaceID 로딩 중...")
        # image_encoder_folder=None: CLIP 인코더 로딩 건너뛰기
        self.pipeline.load_ip_adapter(
            "h94/IP-Adapter-FaceID",
            subfolder="",
            weight_name="ip-adapter-faceid_sdxl.bin",  # non-Plus 버전
            image_encoder_folder=None,  # CLIP 불필요
        )
    else:
        # Standard IP-Adapter 로드
        self.pipeline.load_ip_adapter(
            "h94/IP-Adapter",
            subfolder="sdxl_models",
            weight_name="ip-adapter_sdxl.bin"
        )
```

**세 모델의 차이:**

| 항목 | Standard IP-Adapter | IP-Adapter FaceID | IP-Adapter FaceID Plus v2 |
|------|---------------------|-------------------|---------------------------|
| 입력 | 이미지 (CLIP 인코딩) | InsightFace 512-dim | InsightFace + CLIP 둘 다 |
| 임베딩 | CLIP (시맨틱) | InsightFace (얼굴 특징) | 복합 (더 정확) |
| 정체성 보존 | 낮음 | 높음 | 매우 높음 |
| diffusers 호환 | O | O | X (지원 안됨) |
| 가중치 파일 | ip-adapter_sdxl.bin | ip-adapter-faceid_sdxl.bin | ip-adapter-faceid-plusv2_sdxl.bin |

---

**변경 4: composite_face_auto()에서 FaceID 임베딩 처리 (CFG 지원)**

```python
if self.use_faceid and self.face_id_extractor is not None:
    # FaceID (non-Plus): InsightFace 512-dim 임베딩 사용
    print("   FaceID: InsightFace 임베딩 추출 중...")
    face_embedding = self.face_id_extractor.get_embedding_for_ip_adapter(
        source_face,
        dtype=self.dtype,
        device=self.device
    )

    if face_embedding is not None:
        # Shape 변환: (1, 512) -> (1, 1, 512) for IP-Adapter
        if face_embedding.dim() == 2:
            face_embedding = face_embedding.unsqueeze(1)  # (batch, 1, 512)

        # Classifier-free guidance: negative + positive embeddings
        # Shape: (1, 1, 512) -> (2, 1, 512)
        negative_embedding = torch.zeros_like(face_embedding)
        face_embedding_cfg = torch.cat([negative_embedding, face_embedding], dim=0)

        ip_adapter_kwargs["ip_adapter_image_embeds"] = [face_embedding_cfg]
        print(f"   FaceID 임베딩 shape: {face_embedding_cfg.shape}")
```

**핵심 포인트:**
- CFG (Classifier-free guidance) 지원을 위해 negative + positive 임베딩 결합
- 최종 shape: `(2, 1, 512)` - [negative, positive] 순서
- `ip_adapter_image_embeds`는 리스트 형태로 전달: `[tensor]`

---

**변경 5: 중간 결과 저장 기능 (--save-mask 옵션)**

`--save-mask` 옵션 사용 시 7개의 디버깅 파일 저장:

| 번호 | 파일명 | 설명 |
|------|--------|------|
| 0 | `*_0_background.png` | 배경 이미지 (inpainting 원본) |
| 1 | `*_1_mask.png` | 마스크 (흰색=생성, 검정=보존) |
| 2 | `*_2_overlay.png` | 마스크 오버레이 (빨간색 영역) |
| 3 | `*_3_inpaint_input.png` | Inpainting 입력 (마스크 영역 검정) |
| 4 | `*_4_source_face.png` | IP-Adapter 참조 얼굴 |
| 5 | `*_5_hair_region.png` | BiSeNet 머리카락 영역 |
| 6 | `*_6_mask_contour.png` | 마스크 윤곽선 표시 |
| 7 | `*_7_faceid_info.txt` | FaceID 정보 (모드, 임베딩 shape 등) |

```python
# 예시: 중간 결과 저장 코드
# 0. 배경 이미지
background_path = mask_path.replace('_mask.png', '_0_background.png')
background_image.save(background_path)

# 1. 마스크
mask_path = output_path.replace('.png', '_1_mask.png')
mask.save(mask_path)

# 2. 마스크 오버레이
overlay = background_image.copy()
red_overlay = Image.new('RGBA', background_image.size, (255, 0, 0, 100))
# ... 빨간색 영역 합성

# 3. Inpainting 입력 시각화
inpaint_input_vis = background_image.copy()
# 마스크 영역을 검정색으로

# 4. 원본 얼굴
source_face.save(face_path)

# 5. 머리카락 영역 (BiSeNet 사용 시)
if bisenet_hair_mask is not None:
    hair_vis.save(hair_path)

# 6. 마스크 윤곽선
contour_vis = draw_mask_contour(background_image, mask)
contour_vis.save(contour_path)

# 7. FaceID 정보 텍스트
with open(info_path, 'w') as f:
    f.write(f"Mode: {self.ip_adapter_mode}\n")
    f.write(f"FaceID Embedding Shape: {embedding_shape}\n")
```

---

**변경 6: CLI에 --use-faceid 플래그 추가**

```python
parser.add_argument('--use-faceid', action='store_true',
                   help='IP-Adapter FaceID 사용 (InsightFace 기반, 정체성 보존 향상)')
```

---

#### requirements.txt

```diff
+ # FaceID mode (optional - for IP-Adapter FaceID)
+ # Install: pip install insightface onnxruntime
+ # For Apple Silicon: pip install insightface onnxruntime-silicon
+ insightface>=0.7.3
+ onnxruntime>=1.17.0
```

---

## 3. 실제 테스트 결과

### 3.1 발생했던 에러들과 해결

| 에러 | 원인 | 해결 |
|------|------|------|
| `TypeError: expected str, not NoneType` | `subfolder=None` | `subfolder=""` 로 변경 |
| `OSError: pytorch_model.bin not found` | CLIP 인코더 없음 | `image_encoder_folder=None` 추가 |
| `ValueError: Cannot leave both defined` | ip_adapter_image + embeds 동시 전달 | 하나만 전달 |
| `AttributeError: 'NoneType'.dtype` (Plus v2) | Plus v2 내부에서 CLIP 임베딩 필요 | non-Plus로 변경 |

### 3.2 사용 시나리오

**FaceID 모드 적합:**
- 증명사진 얼굴 교체 (정체성 중요)
- 프로필 사진 생성
- 본인 인증이 필요한 경우

**Standard 모드 적합:**
- 스타일 전이 (정체성보다 분위기 중요)
- 빠른 프로토타이핑
- InsightFace 미설치 환경

### 3.3 제한사항

FaceID 모드에서도 해결되지 않는 문제:
- **머리카락 스타일**: FaceID는 얼굴만 캡처, 머리카락은 Inpainting 생성에 의존
- **생성 속도**: 여전히 50 steps (30-60초)
- **Plus v2 미지원**: diffusers 한계로 non-Plus 버전만 사용 가능

---

## 4. 테스트 방법

```bash
# 1. InsightFace 설치
pip install insightface onnxruntime-silicon  # Apple Silicon

# 2. FaceID 모드 테스트 (중간 결과 저장)
cd inpainting-pipeline
python inpainting-pipeline.py \
    reference-image.png \
    face-image.png \
    --use-faceid \
    --save-mask \
    -o output-faceid.png

# 3. 생성되는 중간 결과 파일들:
# output-faceid_0_background.png  - 배경 원본
# output-faceid_1_mask.png        - 마스크
# output-faceid_2_overlay.png     - 마스크 오버레이
# output-faceid_3_inpaint_input.png - Inpainting 입력
# output-faceid_4_source_face.png - IP-Adapter 참조 얼굴
# output-faceid_5_hair_region.png - 머리카락 영역
# output-faceid_6_mask_contour.png - 마스크 윤곽선
# output-faceid_7_faceid_info.txt - FaceID 정보
```

---

## 5. 향후 개선 계획

1. **Hyper-SD/LCM LoRA 적용** - 속도 개선 (50 steps -> 4 steps)
2. **Hair CLIP Blending 도입** - 머리카락 스타일 전이 개선
3. **ControlNet Depth 통합** - 포즈/구조 보존 강화
4. **FaceID Plus v2 커스텀 구현** - diffusers 우회하여 직접 구현 (선택적)

---

*Inpainting Pipeline v3.1 - FaceID Support (non-Plus)*
*FastFace Project*
