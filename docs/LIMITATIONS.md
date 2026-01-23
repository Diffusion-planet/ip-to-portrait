# Inpainting Pipeline 한계점 및 개선 방향

v2 (BiSeNet 추가) 기준 - 2026-01-18

---

## 1. 핵심 한계점

### 1.1 얼굴 정체성 미보존 (Critical)

**현상:**
- 입력한 얼굴과 다른 사람이 생성됨
- "비슷한 분위기의 다른 사람"이 나옴

**원인:**
```
Standard IP-Adapter = CLIP 임베딩만 사용
                      ↓
CLIP은 이미지의 "시맨틱"을 캡처 (동양인, 남성, 검은 머리...)
                      ↓
구체적인 얼굴 특징 (눈 모양, 코 높이, 얼굴 비율) 손실
```

**비교:**
| 항목 | Inpainting (현재) | FastFace |
|------|-------------------|----------|
| 임베딩 | CLIP only | InsightFace 512-dim + CLIP |
| IP-Adapter | Standard SDXL | FaceID Plus v2 |
| 정체성 정확도 | 낮음 | 높음 |

**해결 방안:**
- IP-Adapter FaceID Plus v2로 교체 필요
- InsightFace 얼굴 임베딩 추출 추가

---

### 1.2 머리카락 스타일 미전이 (Critical)

**현상:**
- 머리카락 영역은 마스킹되지만 스타일이 전이되지 않음
- 앞머리 방향, 볼륨, 질감 등 손실
- "검은 머리카락이 있다" 정도만 인식

**원인:**
```
BiSeNet으로 머리카락 영역 추출
        ↓
IP-Adapter 입력으로 블렌딩
        ↓
CLIP이 머리카락 "시맨틱"만 캡처
        ↓
구체적 스타일 정보 손실
```

**테스트 결과:**
| 시나리오 | 기대 결과 | 실제 결과 |
|----------|-----------|-----------|
| 짧은 머리 남성 | 정확한 스타일 유지 | 기본 짧은 머리 |
| 긴 머리 여성 | 길이와 질감 보존 | 긴 머리지만 다른 스타일 |
| 앞머리 스타일 | 앞머리 방향 유지 | 앞머리 존재만 인식 |

**해결 방안:**
- Hair CLIP Blending 도입 (FastFace v7.3 방식)
- FaceID Plus v2가 머리카락도 정체성 일부로 인식

---

### 1.3 느린 생성 속도

**현상:**
- 50 steps 기본 설정
- MPS에서 30-60초 소요

**비교:**
| 파이프라인 | 기본 스텝 | 생성 시간 (MPS) |
|------------|-----------|-----------------|
| Inpainting | 50 | 30-60초 |
| FastFace | 4 (Hyper-SD) | 2-4초 |

**해결 방안:**
- Hyper-SD LoRA 적용 (4 steps)
- LCM-LoRA 적용 (4-8 steps)

---

## 2. 부가적 한계점

### 2.1 BiSeNet 폴백 시 타원 마스크

**현상:**
- BiSeNet 실패 시 단순 타원형 마스크 사용
- 얼굴 윤곽이 정교하지 않음

**영향:**
- 마스크 경계에서 부자연스러운 합성
- 머리카락 영역 불완전 커버

---

### 2.2 성별 감지 정확도

**현상:**
- 머리카락 coverage 기반 단순 휴리스틱
- 짧은 머리 여성 = 남성으로 오인식 가능

**현재 로직:**
```python
if coverage > 15%:
    return "likely female"
elif coverage > 8%:
    return "ambiguous"
else:
    return "likely male"
```

**영향:**
- 프롬프트에 잘못된 성별 힌트 추가 가능

---

### 2.3 고정된 프롬프트 구조

**현상:**
- "professional ID photo, passport style..." 고정
- 증명사진 외 스타일 적용 어려움

**영향:**
- 다양한 스타일 합성 제한

---

## 3. 개선 로드맵

### Phase 1: 정체성 보존 (핵심)

```
[ ] IP-Adapter FaceID Plus v2 적용
[ ] InsightFace 얼굴 임베딩 추출
[ ] requirements.txt에 insightface 추가
```

**예상 코드 변경:**
```python
# 현재
self.pipeline.load_ip_adapter(
    "h94/IP-Adapter",
    subfolder="sdxl_models",
    weight_name="ip-adapter_sdxl.bin"
)

# 변경
from insightface.app import FaceAnalysis

self.face_analyzer = FaceAnalysis(name='buffalo_l')
self.pipeline.load_ip_adapter(
    "h94/IP-Adapter-FaceID",
    subfolder="",
    weight_name="ip-adapter-faceid-plusv2_sdxl.bin"
)
```

### Phase 2: 속도 개선

```
[ ] Hyper-SD LoRA 적용
[ ] 4 steps 기본값 변경
[ ] 스케줄러 최적화
```

### Phase 3: 품질 개선

```
[ ] Hair CLIP Blending 도입
[ ] 프롬프트 커스터마이징 옵션
[ ] 성별 감지 개선 (얼굴 feature 기반)
```

---

## 4. 현재 버전 권장 사용 사례

**적합:**
- 배경 100% 보존이 필수인 경우
- 얼굴 정체성이 크게 중요하지 않은 경우
- 프로토타이핑 및 테스트
- 마스킹 디버깅 (중간 결과 저장 기능)

**부적합:**
- 정확한 얼굴 정체성 필요 시
- 머리카락 스타일 보존 필요 시
- 빠른 생성이 필요한 프로덕션 환경

---

## 5. FastFace Main Pipeline과의 비교

| 기능 | Inpainting v2 | FastFace | 비고 |
|------|---------------|----------|------|
| 얼굴 정체성 | X | O | FaceID 차이 |
| 머리카락 스타일 | X | O | CLIP Blending 차이 |
| 배경 보존 | O | X | Inpainting 강점 |
| 생성 속도 | X | O | LoRA 차이 |
| 구현 복잡도 | O (단순) | X (복잡) | |
| 메모리 사용 | O (적음) | X (많음) | |

---

*결론: 현재 Inpainting Pipeline은 배경 보존에 특화되어 있으나, 얼굴 정체성 보존이 근본적으로 부족함. IP-Adapter FaceID Plus v2 교체가 필수적인 개선 사항.*
