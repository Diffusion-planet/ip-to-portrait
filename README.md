<p align="center">
  <img src="images/logo.svg" alt="IP-to-Portrait Logo" width="300">
</p>

<h1 align="center">IP-to-Portrait</h1>

<p align="center">
  <strong>SDXL Inpainting + IP-Adapter FaceID Plus v2 기반 얼굴 합성 파이프라인</strong>
</p>

<p align="center">
  Project Prometheus 2025-2 Demo Day - Team 4
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SDXL-Inpainting-blue?style=for-the-badge" alt="SDXL Inpainting" />
  <img src="https://img.shields.io/badge/IP--Adapter-FaceID%20Plus%20v2-green?style=for-the-badge" alt="IP-Adapter" />
  <img src="https://img.shields.io/badge/BiSeNet-Face%20Parsing-orange?style=for-the-badge" alt="BiSeNet" />
  <img src="https://img.shields.io/badge/InsightFace-Face%20Swap-red?style=for-the-badge" alt="InsightFace" />
  <img src="https://img.shields.io/badge/GFPGAN-Face%20Enhance-FF6B6B?style=for-the-badge" alt="GFPGAN" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/CLIP-ViT--H%2F14-9B59B6?style=for-the-badge" alt="CLIP" />
  <img src="https://img.shields.io/badge/Gemini-2.5%20Flash-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini" />
</p>

<p align="center">
  <a href="#개요">개요</a> |
  <a href="#주요-기능">주요 기능</a> |
  <a href="#웹-애플리케이션">웹 애플리케이션</a> |
  <a href="#설치-방법">설치 방법</a> |
  <a href="#ai-파이프라인-구조">AI 파이프라인</a> |
  <a href="#api-엔드포인트">API 엔드포인트</a> |
  <a href="#데이터베이스-erd">Database ERD</a> |
  <a href="#하이퍼파라미터">하이퍼파라미터</a> |
  <a href="#팀원">팀원</a> |
  <a href="#기술-스택">기술 스택</a>
</p>

---

## 개요

IP-to-Portrait는 레퍼런스 이미지의 얼굴을 교체하면서 원본 배경, 포즈, 조명을 완벽하게 보존하는 AI 기반 얼굴 합성 파이프라인이다. 최신 디퓨전 모델과 아이덴티티 보존 어댑터를 결합하여 사실적인 얼굴 합성을 수행한다.

### 프로젝트 목표

- **정체성 보존**: 소스 얼굴 이미지의 얼굴 특징과 개인 특성 유지
- **배경 보존**: 정밀한 인페인팅 마스크를 사용하여 원본 배경 100% 유지
- **스타일 전이**: 소스 얼굴의 헤어스타일 및 전체적인 시각적 특성 적용
- **사용자 친화적 인터페이스**: 노드 기반 워크플로우 시각화를 갖춘 직관적인 웹 인터페이스 제공

### 작동 원리

```
INPUT → PREPROCESSING → GENERATION → POST-PROCESSING → OUTPUT
```

1. **INPUT**: 레퍼런스 이미지(배경/포즈), 얼굴 이미지(정체성), 프롬프트(텍스트 가이드) 입력
2. **PREPROCESSING**: InsightFace로 얼굴 감지 → BiSeNet으로 파싱 → 마스크 생성 → 임베딩 추출
3. **GENERATION**: IP-Adapter FaceID Plus v2로 얼굴 임베딩 주입 → RealVisXL로 인페인팅
4. **POST-PROCESSING**: Face Swap으로 얼굴 유사도 향상 → GFPGAN으로 화질 개선
5. **OUTPUT**: 최종 합성 결과 (WebSocket 실시간 미리보기)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **배경 완벽 보존** | 인페인팅 마스크가 얼굴 영역만 타겟팅하여 배경 유지 |
| **정체성 보존** | IP-Adapter FaceID Plus v2가 InsightFace 임베딩과 CLIP 특징 결합 |
| **Face Swap** | InsightFace inswapper_128로 생성된 얼굴을 소스 얼굴로 교체하여 유사도 향상 |
| **Face Enhance** | GFPGAN v1.4로 얼굴 화질 향상 및 복원 |
| **헤어스타일 전이** | CLIP 이미지 임베딩이 헤어스타일 특성 캡처 및 전이 |
| **정밀 얼굴 파싱** | BiSeNet이 얼굴, 머리카락, 목 영역을 픽셀 수준으로 세그멘테이션 |
| **자동 프롬프트 생성** | Gemini 2.5 Flash VLM이 얼굴 이미지를 분석하여 설명적 프롬프트 생성 |
| **Stop-At 제어** | 생성 과정 중 조기 중단으로 프롬프트 영향력 증가 |
| **병렬 처리** | Celery + Redis로 다중 결과 동시 생성 |
| **실시간 진행 상황** | WebSocket 기반 실시간 진행 업데이트 및 latent 이미지 미리보기 |
| **유연한 인증** | 로그인 없이 사용(localStorage) 또는 계정으로 사용(PostgreSQL 영구 저장) |

---

## 웹 애플리케이션

### 생성 워크플로우 화면

메인 인터페이스는 노드 기반 워크플로우로 입력을 생성 파이프라인에 시각적으로 연결할 수 있다.

![Generation Screen](images/generation-screen.png)

**표시된 기능:**

- Reference Image 노드: 배경/템플릿 이미지 업로드
- Face Image 노드: 소스 정체성 얼굴 업로드
- Positive Prompt 노드: 텍스트 프롬프트 입력 또는 자동 생성
- Inpainting Parameters 노드: 모든 생성 설정 구성
- Generation Control 노드: 개수, 병렬 모드, 시드 설정
- Results 노드: 생성 중 실시간 latent 이미지 미리보기

---

### 인페인팅 파라미터 노드

직관적인 UI로 디퓨전 및 마스킹 파라미터를 구성한다.

![Parameters Node](images/inpainting-parameters-setting-node.png)

---

#### IP-Adapter 모드

얼굴 정체성을 이미지 생성에 주입하는 방식을 선택한다. 총 5가지 모드 제공:

| 모드 | 설명 | 사용 시나리오 |
|------|------|---------------|
| **Simple Inpainting** | IP-Adapter 없이 순수 인페인팅만 수행 | Pre-paste와 함께 사용, 얼굴 이미지를 직접 붙여넣기만 원할 때 |
| **Standard (CLIP)** | CLIP 기반 이미지 임베딩 사용 | 일반적인 스타일/분위기 전달, 얼굴 유사도 낮음 |
| **FaceID** | InsightFace 얼굴 임베딩 사용 | 빠른 처리, 중간 수준 얼굴 유사도 |
| **FaceID Plus v2** ⭐ | 얼굴 임베딩 + CLIP 이미지 결합 | **권장**, 최고 수준 얼굴 유사도 + 자연스러운 결과 |
| **CLIP Blend** | CLIP 임베딩에 얼굴 특징 블렌딩 | 스타일 전달 + 약간의 얼굴 유사도 |

---

#### Diffusion 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| **Steps** | 30 | 디퓨전 스텝 수 (높을수록 품질↑, 속도↓) |
| **Guidance Scale** | 5.5 | 프롬프트 준수 강도 (높을수록 프롬프트에 충실) |
| **Denoise Strength** | 0.9 | 원본 이미지 변경 정도 (1.0 = 완전 재생성) |
| **Face Strength** | 0.8 | IP-Adapter 얼굴 가이드 강도 |
| **Stop At** | 90% | 조기 종료 비율 (마지막 스텝 스킵으로 자연스러움 향상) |

---

#### Mask 설정

얼굴 마스크 생성 옵션:

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| **Include Hair** | On | 마스크에 머리카락 포함 (헤어스타일 변경 시 On) |
| **Include Neck** | Off | 마스크에 목 포함 |
| **Expand** | 1.2 | 마스크 확장 비율 (1.0 = 원본 크기) |
| **Blur** | 30 | 마스크 경계 블러 강도 (자연스러운 블렌딩) |
| **Padding** | 50px | 마스크 외곽 패딩 |

---

#### Pre-paste 모드

소스 얼굴을 배경 이미지에 **미리 붙여넣은 후** 인페인팅을 수행하는 모드.

**작동 원리:**
1. 소스 얼굴을 레퍼런스 이미지의 얼굴 위치에 정확하게 붙여넣기
2. 붙여넣은 이미지를 기반으로 인페인팅 수행
3. 얼굴 위치와 크기가 더 정확하게 유지됨

**설정:**
| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| **Pre-paste 토글** | Off | Pre-paste 모드 활성화 |
| **Denoising** | 0.65 | Pre-paste 시 디노이징 강도 (낮을수록 붙여넣은 얼굴 유지) |

**권장 사용 시나리오:**
- 얼굴 위치가 계속 어긋날 때
- `Simple Inpainting` 모드와 함께 사용 (IP-Adapter 없이 순수 붙여넣기 + 블렌딩)
- 특정 얼굴 방향/각도를 정확하게 유지하고 싶을 때

**Tip:** Pre-paste + Simple Inpainting 조합은 가장 직접적인 얼굴 교체 방식. Denoising 0.5-0.7 권장.

---

#### POST-PROCESSING (후처리)

생성된 이미지에 추가적인 얼굴 처리를 적용하는 섹션.

##### Face Swap

생성된 이미지의 얼굴을 소스 얼굴로 **교체**하여 유사도를 향상시킨다.

**작동 원리:**
1. 생성된 이미지에서 얼굴 감지 (InsightFace)
2. 소스 얼굴의 특징/임베딩 추출
3. Face Swap 모델로 얼굴 교체 (피부톤, 조명 자동 보정)
4. 배경과 자연스럽게 블렌딩

**모델 비교:**

| 모델 | 기술 | 해상도 | 특징 | 속도 | 권장 |
|------|------|--------|------|------|------|
| **InsightFace 128** | ONNX 기반 | 128x128 | 안정적, 검증됨, CPU 실행 | ⚡ 빠름 | ⭐ **권장** |
| **Ghost** | AEI-Net + ArcFace | 256x256 | 고화질, 실험적, GPU 필요 | 🐢 느림 | 선택적 |

**InsightFace 128 상세:**
- `inswapper_128.onnx` 모델 사용
- CPU에서 실행되어 GPU 메모리 충돌 없음
- 대부분의 경우에 충분히 좋은 품질
- 빠르고 안정적 → **일반 사용에 권장**

**Ghost 상세:**
- AEI-Net (Adaptive Embedding Integration Network) 아키텍처
- ArcFace 임베딩으로 정체성 보존
- 256x256 해상도로 더 세밀한 디테일
- mxnet 의존성 제거 (InsightFace 기반 정렬 사용)
- **실험적 상태** - 일부 환경에서 불안정할 수 있음

**파라미터:**

| 파라미터 | 기본값 | 범위 | 설명 |
|----------|--------|------|------|
| **Face Swap 토글** | Off | On/Off | Face Swap 기능 활성화 |
| **Model** | InsightFace | InsightFace / Ghost | 사용할 Face Swap 모델 |

---

**Refinement (Face Swap 후처리):**

Face Swap 후 경계선이 부자연스러울 경우, 가벼운 인페인팅으로 자연스럽게 블렌딩.

| 파라미터 | 기본값 | 범위 | 설명 |
|----------|--------|------|------|
| **Refinement 토글** | Off | On/Off | Face Swap 후 추가 블렌딩 |
| **Strength** | 30% | 0-100% | 인페인팅 강도 |

**Strength 값에 따른 효과:**

| 값 | 효과 | 사용 시점 |
|----|------|-----------|
| **10-20%** | 미세한 경계 블렌딩만 | 경계선만 살짝 다듬고 싶을 때 |
| **30-50%** | 균형잡힌 블렌딩 | 일반적인 경우 (기본 권장) |
| **60-80%** | 강한 재생성 | 경계가 많이 어색할 때 |
| **90%+** | 거의 재생성 | ⚠️ 얼굴이 많이 변할 수 있음 |

> **주의:** Strength가 높을수록 Face Swap된 얼굴이 원본과 달라질 수 있습니다. 얼굴이 정상적으로 생성되었다면 **Refinement Off 권장**.

##### Face Enhance

**GFPGAN v1.4**를 사용하여 얼굴 품질을 향상/복원시킨다.

**작동 원리:**
1. 생성된 이미지에서 얼굴 영역 감지 (InsightFace)
2. GFPGAN v1.4 모델로 얼굴 복원/향상
3. 피부 질감, 눈, 입, 머리카락 등 세부 디테일 개선
4. 원본 배경과 Strength 비율로 블렌딩

**파라미터:**

| 파라미터 | 기본값 | 범위 | 설명 |
|----------|--------|------|------|
| **Face Enhance 토글** | Off | On/Off | GFPGAN 얼굴 향상 활성화 |
| **Strength** | 80% | 0-100% | 향상된 얼굴과 원본의 블렌딩 비율 |

**Strength 값에 따른 효과:**

| 값 | 효과 | 사용 시점 |
|----|------|-----------|
| **50-60%** | 자연스러운 향상 | 약간의 선명도만 원할 때 |
| **70-80%** | 균형잡힌 향상 | 일반적인 사용 (기본 권장) |
| **85-95%** | 강한 향상 | Face Swap 후 화질 복원 |
| **100%** | 최대 복원 | 완전히 GFPGAN 결과 사용 |

**향상되는 영역:**
- 👁️ **눈**: 더 선명하고 디테일한 눈동자
- 👃 **피부**: 매끄럽고 자연스러운 피부 질감
- 👄 **입술**: 선명한 윤곽과 색상
- 💇 **머리카락**: 경계 부분 개선

**사용 시나리오:**
- ✅ Face Swap 후 얼굴이 흐릿하거나 뭉개질 때
- ✅ 저해상도 소스 이미지 사용 시
- ✅ 더 선명하고 깨끗한 얼굴 결과가 필요할 때
- ⚠️ 너무 높은 Strength는 얼굴이 "플라스틱"처럼 보일 수 있음

> **주의:** 사람마다 GFPGAN의 영향이 다를 수 있습니다. 얼굴이 원본과 너무 달라진다면 Strength를 **70-80%**로 낮추세요.

**Tip:** Face Swap + Face Enhance 조합 사용 시 최상의 결과. Strength 80-95% 권장.

---

### 🎯 추천 세팅 가이드

실제 사용 경험을 바탕으로 한 권장 설정입니다.

#### 전체 파이프라인 이해

```
[소스 얼굴] + [레퍼런스 배경] + [프롬프트]
                    ↓
        IP-Adapter (FaceID Plus v2)
        → 머리카락 + 얼굴 특징 합성
                    ↓
           Inpainting Model
        → 전체 얼굴 생성 (프롬프트 반영)
                    ↓
              Face Swap
        → 소스 얼굴로 교체 (유사도 향상)
                    ↓
             Face Enhance
        → GFPGAN으로 화질 개선
                    ↓
              [최종 결과]
```

#### 권장 설정

| 섹션 | 파라미터 | 권장값 | 설명 |
|------|----------|--------|------|
| **IP-Adapter** | Mode | FaceID Plus v2 | 얼굴 유사도 + 자연스러움 최적 균형 |
| **Diffusion** | Stop At | 85-95% | 낮출수록 프롬프트 영향↑ (얼굴 윤곽 조정 가능) |
| **Mask** | Include Hair | ✅ On | 헤어스타일 변경 허용 |
| **Mask** | Include Neck | ✅ On | 목까지 자연스럽게 블렌딩 |
| **Pre-paste** | 활성화 | ❌ Off | 비정상적 얼굴 생성 가능성 있음 |
| **Face Swap** | 활성화 | ✅ On | 얼굴 유사도 대폭 향상 |
| **Face Swap** | Model | InsightFace 128 | 안정적이고 빠름 |
| **Face Swap** | Refinement | ❌ Off (기본) | 얼굴이 비정상일 때만 활성화 |
| **Face Enhance** | 활성화 | ✅ On | 화질 개선 필수 |
| **Face Enhance** | Strength | 80-95% | 높여도 무방, 얼굴 변화 시 낮춤 |

#### 상세 팁

**프롬프트 활용:**
- Stop At을 낮추면 (85-90%) 프롬프트가 얼굴 윤곽, 중안부 길이 등에 더 많이 영향을 줌
- 얼굴 형태를 조정하고 싶다면 Stop At을 낮추고 프롬프트에 원하는 특징 기술

**Pre-paste 주의:**
- 이론적으로는 얼굴 위치를 정확하게 유지해야 하지만, 실제로는 비정상적 얼굴이 생성되는 경우가 있음
- 일반적인 사용에서는 **비활성화 권장**

**Face Swap + Refinement:**
- Face Swap만으로 충분히 좋은 결과가 나옴
- Refinement는 Face Swap 경계가 부자연스러울 때만 사용
- Refinement Strength가 높으면 얼굴이 원본과 달라질 수 있음

**Face Enhance:**
- 화질 향상을 위해 **항상 활성화 권장**
- Strength를 높여도 대체로 안전하지만, 사람에 따라 영향이 다름
- 얼굴이 너무 달라진다면 Strength를 70-80%로 낮춤

**요약 - 기본 권장 조합:**
```
IP-Adapter: FaceID Plus v2
Face Swap: ✅ On (InsightFace 128)
Face Enhance: ✅ On (Strength 85-95%)
Pre-paste: ❌ Off
Refinement: ❌ Off
```

---

### 자동 프롬프트 생성

Auto Generate 토글을 활성화하면 Gemini 2.5 Flash가 지능적으로 프롬프트를 생성한다.

![Auto Prompt Node](images/auto-prompt-generation-node.png)

VLM이 얼굴 특징을 분석하여 상세한 설명적 프롬프트를 생성한다:

- 나이, 민족, 성별 추정
- 얼굴 구조 및 특징 설명
- 피부 톤 및 안색
- 헤어스타일 및 색상
- 전체적인 분위기 및 표정

---

### 생성 제어 및 실시간 미리보기

병렬 처리 지원으로 배치 생성을 제어하고 실시간으로 결과가 나타나는 것을 볼 수 있다.

![Generation Control](images/generation-control-and-step-result-latent-image-return-node.png)

**기능:**

- **Count**: 배치당 1-8개 이미지 생성
- **Parallel**: 동시 생성 활성화 (Celery + 다중 GPU 필요)
- **Seed**: 특정 시드 설정 또는 랜덤 사용
- **Stop**: 진행 중인 생성 취소
- **실시간 Latent 미리보기**: 디퓨전 과정이 단계별로 펼쳐지는 것을 관찰

---

### 생성 히스토리

전체 파라미터 리콜 기능으로 이전 생성에 접근한다.

![History Modal](images/generation-history-modal.png)

- 얼굴 이미지, 레퍼런스 이미지, 결과 썸네일 보기
- 타임스탬프 및 프롬프트 요약 확인
- 생성 파라미터 빠른 접근 (Steps, CFG, Count)
- 원치 않는 히스토리 항목 삭제

**참고**: 비로그인 사용자는 히스토리가 localStorage에 저장된다. 로그인 사용자는 PostgreSQL에 영구 저장된다.

---

### 생성 리포트

모든 파라미터와 다운로드 가능한 결과가 포함된 각 생성에 대한 상세 리포트.

![Report Modal](images/generation-report-modal.png)

**리포트 내용:**

- 입력 이미지 (Face 및 Reference)
- 전체 프롬프트 텍스트
- 정리된 그리드의 모든 생성 파라미터
- 다운로드/복사 옵션이 있는 출력 이미지

---

### 인증

디바이스 간 영구 히스토리를 위한 선택적 계정 시스템.

| 로그인 | 회원가입 |
|--------|----------|
| ![Login](images/login-screen.png) | ![Sign Up](images/signup-screen.png) |

- JWT 토큰을 사용한 이메일/비밀번호 인증
- 이름, 이메일, 비밀번호로 계정 생성
- bcrypt를 사용한 안전한 비밀번호 해싱

---

## AI 파이프라인 구조

### 파이프라인 다이어그램

전체 얼굴 인페인팅 파이프라인의 시각적 표현.

![Pipeline Diagram](images/face-inpainting-pipeline.png)

### 파이프라인 흐름 설명

파이프라인은 5단계로 구성된다: **INPUT → PREPROCESSING → GENERATION → POST-PROCESSING → OUTPUT**

#### 1. INPUT (입력)

| 입력 | 설명 |
|------|------|
| **Reference Image** | 배경과 포즈를 제공하는 기준 이미지 |
| **Face Image** | 합성할 얼굴의 정체성을 담은 이미지 |
| **Prompt** | 텍스트 가이드 (선택적, Gemini 자동 생성 가능) |

#### 2. PREPROCESSING (전처리)

| 단계 | 모델 | 역할 |
|------|------|------|
| **Face Detection** | InsightFace (buffalo_l) | 얼굴 위치 및 랜드마크 감지 |
| **Face Parsing** | BiSeNet | 얼굴 영역 세그멘테이션 (피부, 눈, 코, 입, 머리카락, 목) |
| **Mask Generation** | - | 인페인팅 영역 정의 (확장, 블러, 패딩 적용) |
| **Embedding Extraction** | InsightFace + CLIP | 512D 얼굴 임베딩 + 257x1280 이미지 임베딩 |

#### 3. GENERATION (생성)

| 단계 | 모델 | 역할 |
|------|------|------|
| **IP-Adapter Injection** | FaceID Plus v2 | 얼굴 임베딩을 SDXL 어텐션 레이어에 주입 |
| **Inpainting** | RealVisXL V4.0 | 마스크 영역 재생성 (배경 보존) |

#### 4. POST-PROCESSING (후처리)

| 단계 | 모델 | 역할 | 기본값 |
|------|------|------|--------|
| **Face Swap** | InsightFace (inswapper_128) | 생성된 얼굴을 소스 얼굴로 교체 | On |
| **Refinement** | RealVisXL (재사용) | Face Swap 경계 블렌딩 | Off |
| **Face Enhance** | GFPGAN v1.4 | 얼굴 화질 향상/복원 | On |

#### 5. OUTPUT (출력)

- 최종 합성 결과 이미지
- WebSocket을 통한 실시간 진행 상황 업데이트

### 모델 구성

| 모델 | 용도 | 크기 |
|------|------|------|
| **RealVisXL V4.0 Inpainting** | 기본 디퓨전 모델 (SDXL 기반) | ~6GB |
| IP-Adapter FaceID Plus v2 | 얼굴 정체성 주입 | ~100MB |
| CLIP ViT-H/14 | 이미지 임베딩 추출 | ~2GB |
| InsightFace (buffalo_l) | 얼굴 임베딩 + Face Swap | ~300MB |
| BiSeNet | 얼굴 파싱/세그멘테이션 | ~50MB |
| GFPGAN v1.4 | 얼굴 화질 향상 | ~350MB |
| Gemini 2.5 Flash | 자동 프롬프트 생성 (API) | Cloud |

> **RealVisXL V4.0**은 포토리얼리스틱 이미지 생성에 최적화된 SDXL 기반 모델입니다. 기본 SDXL Inpainting보다 더 사실적인 얼굴과 피부 질감을 생성합니다.

### Stop-At 기능

Stop-At 파라미터는 IP-Adapter FaceID가 생성에 영향을 미치는 것을 언제 중단할지 제어하여, 후반 단계에서 더 많은 프롬프트 영향을 허용한다. 예를 들어 stop_at=0.7로 설정하면 생성 과정의 70% 지점까지는 FaceID가 강하게 정체성과 구조를 가이드하고, 이후 30%는 FaceID 영향 없이 프롬프트만으로 자연스러운 디테일을 완성한다.

| Stop-At 값 | 효과 | 사용 시점 |
|------------|------|-----------|
| 1.0 | 전체 과정에서 FaceID 적용 | 최대 정체성 보존 |
| 0.7-0.8 | 70-80%에서 FaceID 중단 | 권장 균형점 |
| 0.5-0.6 | 초반 스텝에서만 FaceID | 얼굴이 부자연스러울 때 |

---

## 설치 방법

### 사전 요구사항

- Python 3.10 이상
- Node.js 18 이상
- NVIDIA GPU with CUDA (권장) 또는 Apple Silicon Mac
- PostgreSQL 16+, Redis 7+ (Docker 또는 직접 설치)

### ONNX Runtime 설치 가이드

플랫폼에 따라 적절한 ONNX Runtime 패키지를 설치해야 합니다:

| 플랫폼 | 설치 명령어 |
|--------|-------------|
| **NVIDIA CUDA GPU** | `pip install onnxruntime-gpu>=1.17.0` |
| **Apple Silicon (M1/M2/M3)** | `pip install onnxruntime-silicon` |
| **CPU only** | `pip install onnxruntime>=1.17.0` |

> **참고**: `requirements.txt`에는 기본적으로 `onnxruntime-gpu`가 포함되어 있습니다. Apple Silicon 또는 CPU 환경에서는 설치 후 적절한 버전으로 교체하세요.

---

### 방법 A: 클라우드 GPU 서버 (Docker 사용 불가 환경)

> **대상 환경**: Runpod, Vast.ai, Lambda Labs 등 Docker-in-Docker가 불가능한 클라우드 GPU 플랫폼
>
> 이러한 플랫폼들은 이미 Docker 컨테이너 내에서 실행되므로 내부에서 Docker를 사용할 수 없습니다. 따라서 PostgreSQL과 Redis를 직접 설치합니다.

**테스트 환경**: Runpod GPU Pod (A100 PCIe 2x, 63 vCPU, 235GB RAM, runpod-torch-v240 템플릿)

#### (선택) 개발 환경 설정

> **선택 사항**: 클라우드 GPU 환경에서 보다 편리하게 개발하고 싶다면, Claude Code와 Oh My Zsh 등 개발 도구를 자동으로 설치할 수 있습니다.

```bash
bash scripts/setup.sh
```

이 스크립트가 설치하는 내용:
- Oh My Zsh (터미널 테마 및 플러그인)
- Claude Code CLI 및 VS Code 확장
- 한국어 언어 팩
- 개발 유틸리티 (zsh, tmux, nvtop 등)

#### 자동 설치 (스크립트 사용)

```bash
# 레포지토리 클론
git clone https://github.com/Diffusion-planet/ip-to-portrait.git
cd ip-to-portrait

# 전체 설치 스크립트 실행 (프론트엔드 + 백엔드)
bash scripts/setup_all.sh
```

이 스크립트가 자동으로 수행하는 작업:
- PostgreSQL, Redis 설치 및 설정
- Python venv 생성 및 requirements 설치
- nvm을 통한 Node.js 설치
- npm 의존성 설치
- 데이터베이스 마이그레이션
- .env 파일 생성

#### 설치 후 서비스 시작

서비스를 시작하는 방법은 두 가지가 있습니다:
- **방법 1 (권장)**: 각 터미널에서 개별 실행 - 로그 확인이 용이하고 디버깅에 적합
- **방법 2**: 스크립트로 한번에 실행 - 빠른 시작에 적합

---

##### 방법 1: 개별 서비스 실행 (권장)

각 서비스를 별도의 터미널에서 실행합니다. 각 서비스의 로그를 독립적으로 확인할 수 있어 디버깅에 유리합니다.

**터미널 1 - Backend (FastAPI):**

```bash
cd web/backend
../../venv/bin/uvicorn main:app --host 0.0.0.0 --port 8008 --reload
```

- `--reload`: 코드 변경 시 자동 재시작 (개발 모드)
- 접속 주소: `http://localhost:8008`
- API 문서: `http://localhost:8008/docs`

**터미널 2 - Frontend (Next.js):**

```bash
cd web/frontend
npm run dev
```

- 접속 주소: `http://localhost:3008`
- 핫 리로드 지원

**터미널 3 - Celery Workers (GPU 작업 처리):**

```bash
# 프로젝트 루트에서 실행
./start_celery_workers.sh
```

이 스크립트는:
- 기존 워커를 자동 종료
- 지정된 GPU(기본: 5, 6, 7)에서 각각 워커 시작
- 로그를 `logs/` 디렉토리에 저장

**Celery 로그 확인:**

```bash
# 모든 워커 로그 동시 확인
tail -f logs/worker*.log

# 개별 워커 로그
tail -f logs/worker5.log  # GPU 5
tail -f logs/worker6.log  # GPU 6
tail -f logs/worker7.log  # GPU 7
```

**Celery 워커 종료:**

```bash
pkill -f 'celery -A tasks worker'
```

> **참고**: GPU ID를 변경하려면 `start_celery_workers.sh` 파일을 편집하거나, `scripts/start_celery_multi_gpu.sh`를 사용하세요:
> ```bash
> GPU_IDS="0,1,2" bash scripts/start_celery_multi_gpu.sh
> ```

---

##### 방법 2: 스크립트로 한번에 실행

빠른 시작이 필요하거나 모든 서비스를 한 번에 관리하고 싶을 때 사용합니다.

**옵션 A - 백그라운드 실행:**

```bash
bash scripts/start_all.sh
```

- 모든 서비스를 백그라운드에서 시작
- Backend가 포그라운드에서 실행되어 로그 확인 가능
- 로그 파일: `logs/` 디렉토리

**옵션 B - tmux 분할 화면 (권장):**

```bash
bash scripts/start_all_tmux.sh
```

4개의 분할 창에서 모든 서비스 로그를 실시간으로 확인:

```
+------------+------------+
|  Backend   |   Celery   |
+------------+------------+
|   Shell    |  Frontend  |
+------------+------------+
```

**tmux 단축키:**

| 키 조합 | 동작 |
|---------|------|
| `Ctrl+B` → `방향키` | 창 간 이동 |
| `Ctrl+B` → `D` | 세션 분리 (백그라운드 유지) |
| `Ctrl+B` → `Z` | 현재 창 전체화면 토글 |
| `Ctrl+B` → `[` | 스크롤 모드 (q로 종료) |

> **Mac 사용자 참고**: `Ctrl+B` → `방향키`가 작동하지 않으면:
> - `Ctrl+B` → `o`: 다음 창으로 이동
> - `Ctrl+B` → `q` → `숫자`: 창 번호로 이동
> - `tmux set -g mouse on`: 마우스 지원 활성화 (클릭으로 창 선택)

**tmux 명령어:**

```bash
tmux attach -t ip-to-portrait    # 분리된 세션에 다시 연결
tmux kill-session -t ip-to-portrait  # 세션 종료 (모든 서비스 중단)
```

---

#### 다중 GPU 병렬 처리

여러 GPU가 있는 환경에서 진정한 병렬 처리를 하려면 각 GPU마다 별도의 Celery 워커가 필요합니다.

| 설정 | 설명 |
|------|------|
| 단일 워커 | 순차 처리 (기본) |
| 다중 워커 (GPU별) | 병렬 처리 가능 |

**워커 시작:**

```bash
# 기본 GPU 사용 (start_celery_workers.sh에 설정된 GPU)
./start_celery_workers.sh

# 또는 특정 GPU 지정
GPU_IDS="0,1,2,3" bash scripts/start_celery_multi_gpu.sh
```

> **중요**: 프론트엔드에서 **"Parallel" 체크박스**를 활성화해야 병렬 처리가 적용됩니다.
> 단일 워커만 실행 중이면 Parallel 체크와 관계없이 순차 처리됩니다.

#### (선택) Face Swap 모델 설치

Face Swap 기능을 위한 추가 모델을 설치할 수 있습니다. 기본으로 InsightFace (inswapper_128)이 사용되며, 더 고품질을 원할 경우 아래 모델을 설치하세요.

**Ghost (고화질 Face Swap):**

Ghost는 AEI-Net 아키텍처를 사용하는 고품질 Face Swap 모델입니다.

```bash
bash scripts/setup_ghost.sh
```

이 스크립트가 수행하는 작업:
- Ghost 레포지토리 클론 및 서브모듈 설정
- Generator, ArcFace 등 필요한 모델 다운로드
- kornia, face-alignment 의존성 설치

> **참고**: Google Drive에서 다운로드가 실패할 경우, [Ghost GitHub](https://github.com/ai-forever/ghost#pretrained-models)에서 수동으로 다운로드하세요.

**inswapper_512 (고해상도 InsightFace):**

기본 inswapper_128보다 4배 높은 해상도의 Face Swap 모델입니다.

```bash
bash scripts/download_inswapper512.sh
```

> **참고**: Hugging Face에서 모델을 찾을 수 없는 경우, 'inswapper_512.onnx'를 검색하여 `~/.insightface/models/buffalo_l/` 디렉토리에 수동으로 배치하세요.

---

#### 포트 포워딩 설정 (클라우드 GPU)

클라우드 GPU 플랫폼 대시보드에서 다음 포트를 외부에서 접근할 수 있도록 설정합니다:
- **3008**: 프론트엔드 (Next.js)
- **8008**: 백엔드 (FastAPI)

**Runpod**: Connect 메뉴 → "Expose HTTP Ports" 옵션 사용
**Vast.ai**: Instance 설정에서 포트 매핑 추가
**기타**: SSH 터널링 사용 (`ssh -L 3008:localhost:3008 -L 8008:localhost:8008 user@server`)

#### Pod/인스턴스 재시작 시 venv 재생성

클라우드 GPU 플랫폼에서 Pod이나 인스턴스를 재시작하면 워크스페이스 경로가 변경될 수 있습니다 (예: `/root/...` → `/workspace/...`).
이 경우 venv의 shebang 경로가 맞지 않아 `bad interpreter` 에러가 발생합니다.

```bash
# venv 재생성 (경로 변경 시)
cd /workspace/prometheus/ip-to-portrait
rm -rf venv
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# 서비스 재시작
./scripts/start_all_tmux.sh
```

---

### 방법 B: 로컬/서버 환경 (Docker 사용)

Docker가 사용 가능한 일반 서버 환경용입니다.

#### 1. 레포지토리 클론

```bash
git clone https://github.com/Diffusion-planet/ip-to-portrait.git
cd ip-to-portrait
```

#### 2. 가상환경 생성

```bash
# 프로젝트 루트에 venv 생성
python -m venv venv

# 활성화 (macOS/Linux)
source venv/bin/activate

# 활성화 (Windows)
.\venv\Scripts\activate
```

#### 3. AI 파이프라인 의존성 설치

```bash
# venv 활성화 상태에서
pip install -r requirements.txt

# Apple Silicon의 경우:
pip uninstall onnxruntime-gpu -y
pip install onnxruntime-silicon

# CPU만 사용하는 경우:
pip uninstall onnxruntime-gpu -y
pip install onnxruntime
```

#### 4. 환경 변수 설정

```bash
# 예제 파일 복사 후 편집
cp .env.example .env

# .env 파일에 값 입력:
# GEMINI_API_KEY=your_gemini_api_key_here
# DATABASE_URL=postgresql+asyncpg://fastface:password@localhost:5433/fastface
# POSTGRES_PASSWORD=your_secure_password
# SECRET_KEY=your_jwt_secret_key
# USE_CELERY=true
# REDIS_URL=redis://localhost:6379/0
```

#### 5. Docker 서비스 시작

```bash
cd web/backend

# PostgreSQL과 Redis 시작
docker-compose up -d postgres redis

# 서비스 실행 확인
docker-compose ps
```

#### 6. 데이터베이스 초기화

```bash
cd web/backend

# 데이터베이스 마이그레이션 실행
alembic upgrade head
```

#### 7. 프론트엔드 의존성 설치

```bash
cd web/frontend

# Node.js 패키지 설치
npm install
```

#### 8. 애플리케이션 실행

**터미널 1 - 백엔드:**

```bash
cd web/backend
source ../../venv/bin/activate  # venv 활성화
python main.py
# 서버가 http://localhost:8008 에서 실행됨
```

**터미널 2 - 프론트엔드:**

```bash
cd web/frontend
npm run dev
# 앱이 http://localhost:3008 에서 실행됨
```

**터미널 3 - Celery Worker (병렬 GPU 처리용):**

```bash
cd web/backend
source ../../venv/bin/activate
celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1
```

---

### Docker 서비스 구성 (방법 B 전용)

`web/backend/`의 `docker-compose.yml`이 제공하는 서비스:

| 서비스 | 이미지 | 포트 | 용도 |
|--------|--------|------|------|
| postgres | postgres:16-alpine | 5433 | 사용자 계정 및 생성 히스토리 |
| redis | redis:7-alpine | 6379 | 병렬 처리를 위한 Celery 태스크 큐 |
| celery-worker | Custom | - | 백그라운드 생성을 위한 GPU 워커 |

**다중 GPU를 위한 워커 스케일링:**

```bash
docker-compose up -d --scale celery-worker=4
```

---

### 첫 실행 시 모델 다운로드

처음 생성을 실행하면 HuggingFace에서 필요한 모델들이 자동으로 다운로드됩니다.

| 모델 | 크기 | 다운로드 위치 |
|------|------|---------------|
| RealVisXL V4.0 Inpainting | ~6GB | `~/.cache/huggingface/` |
| IP-Adapter FaceID Plus v2 | ~100MB | `~/.cache/huggingface/` |
| CLIP ViT-H/14 | ~2GB | `~/.cache/huggingface/` |
| InsightFace (buffalo_l) | ~300MB | `~/.insightface/models/` |
| BiSeNet | ~50MB | 프로젝트 내 자동 다운로드 |
| GFPGAN v1.4 | ~350MB | `~/.cache/` (자동 다운로드) |

> **참고**: 첫 생성 시 모델 다운로드로 인해 시간이 걸릴 수 있습니다. 이후 실행에서는 캐시된 모델을 사용합니다.

---

### 트러블슈팅

| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
| `bad interpreter: no such file` | 프로젝트 경로 변경 후 venv 경로 불일치 | venv 삭제 후 재생성: `rm -rf venv && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt` |
| `Connection refused` (PostgreSQL) | PostgreSQL 서비스 미실행 | `service postgresql start` |
| `Connection refused` (Redis) | Redis 서비스 미실행 | `redis-server --daemonize yes` |
| `CUDA out of memory` | GPU 메모리 부족 | 배치 크기(count) 줄이기, 다른 GPU 프로세스 종료 |
| `Port 8008/3008 already in use` | 이전 프로세스가 종료되지 않음 | `lsof -i :8008`로 PID 확인 후 `kill <PID>` |
| `Model download failed` | HuggingFace 네트워크 오류 | 재시도 또는 VPN 사용, `HF_ENDPOINT` 환경변수로 미러 설정 |
| `BiSeNet 79999_iter.pth 404` | GitHub releases 링크 삭제됨 | 자동으로 Google Drive에서 다운로드 시도 (gdown 사용). 수동: `gdown 154JgKpzCPW82qINcVieuPH3fZ2e0P812 -O models_cache/79999_iter.pth` |
| `google-genai 패키지 없음` | Gemini 자동 프롬프트 미작동 | `./venv/bin/pip install google-genai` |
| `asyncpg.exceptions` | DB 연결 정보 불일치 | `.env` 파일의 `DATABASE_URL`과 PostgreSQL 설정 확인 |

---

## API 엔드포인트

### 인증

| 메소드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | `/api/auth/register` | 새 사용자 계정 생성 |
| POST | `/api/auth/login` | 로그인 및 JWT 토큰 수신 |
| POST | `/api/auth/logout` | 로그아웃 (클라이언트 측 토큰 삭제) |
| GET | `/api/auth/me` | 현재 사용자 정보 조회 |

### 생성

| 메소드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | `/api/generation/start` | 새 생성 배치 시작 |
| GET | `/api/generation/status/{batch_id}` | 배치 상태 및 진행 상황 조회 |
| GET | `/api/generation/task/{task_id}` | 개별 태스크 상태 조회 |
| POST | `/api/generation/cancel/{batch_id}` | 배치의 모든 태스크 취소 |
| POST | `/api/generation/task/{task_id}/regenerate` | 새 시드로 재생성 |

### 업로드

| 메소드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | `/api/upload/image` | 얼굴 또는 레퍼런스 이미지 업로드 |
| DELETE | `/api/upload/{file_id}` | 업로드된 파일 삭제 |

### 히스토리

| 메소드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | `/api/history/` | 생성 히스토리 조회 (페이지네이션) |
| GET | `/api/history/{item_id}` | 특정 히스토리 항목 조회 |
| POST | `/api/history/{item_id}/favorite` | 즐겨찾기 상태 토글 |
| PATCH | `/api/history/{item_id}/title` | 히스토리 항목 제목 수정 |
| DELETE | `/api/history/{item_id}` | 히스토리 항목 삭제 |
| DELETE | `/api/history/` | 전체 히스토리 삭제 |

### 설정

| 메소드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | `/api/settings/` | 현재 설정 조회 |
| PUT | `/api/settings/` | 전체 설정 업데이트 |
| PATCH | `/api/settings/params` | 기본 파라미터 업데이트 |
| POST | `/api/settings/reset` | 기본값으로 초기화 |

### WebSocket

| 엔드포인트 | 설명 |
|------------|------|
| `ws://{host}/ws/{client_id}` | 실시간 진행 상황 및 latent 이미지 업데이트 |

---

## 데이터베이스 ERD

![ERD Diagram](images/erd.png)

### 테이블 구조

**users**

- `id` (PK): UUID
- `email`: 고유 이메일 주소
- `name`: 표시 이름
- `hashed_password`: bcrypt 해시
- `is_active`: 계정 상태
- `created_at`, `updated_at`: 타임스탬프

**history**

- `id` (PK): UUID
- `user_id` (FK): users 참조
- `title`: 선택적 생성 제목
- `face_image_url`, `reference_image_url`: 입력 이미지
- `result_urls`: 출력 URL의 JSONB 배열
- `prompt`: 생성 프롬프트 텍스트
- `params`: 모든 생성 파라미터가 포함된 JSONB
- `count`, `parallel`: 배치 설정
- `is_favorite`: 즐겨찾기 플래그
- `created_at`: 타임스탬프

---

## 하이퍼파라미터

### Diffusion 파라미터

| 파라미터 | 범위 | 기본값 | 권장값 | 설명 |
|----------|------|--------|--------|------|
| `steps` | 1-100 | 50 | 30-50 | 디퓨전 스텝 수 (높을수록 품질↑, 속도↓) |
| `guidance_scale` | 1-20 | 3.0 | 2.5-5.0 | CFG 스케일 - 낮을수록 자연스러움 |
| `denoise_strength` | 0.0-1.0 | 0.92 | 0.85-0.95 | 생성 강도 - 높을수록 더 많이 재생성 |
| `face_strength` | 0.0-1.5 | 0.85 | 0.7-0.9 | 정체성을 위한 IP-Adapter 스케일 |
| `stop_at` | 0.0-1.0 | 1.0 | 0.85-0.95 | FaceID 영향 중단 시점 (조기 종료로 자연스러움 향상) |

### Mask 파라미터

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `include_hair` | bool | true | 마스크에 머리카락 영역 포함 |
| `include_neck` | bool | true | 마스크에 목 영역 포함 |
| `mask_expand` | 0.0-1.0 | 0.3 | 마스크 확장 비율 (1.0 = 30% 확장) |
| `mask_blur` | 0-100 | 15 | 마스크 경계 블러 (픽셀) |
| `mask_padding` | -100-100 | 10 | 추가 마스크 확장/축소 (픽셀) |

### IP-Adapter 모드

| 모드 | 정체성 | 스타일 | 설명 |
|------|--------|--------|------|
| Simple Inpainting | 없음 | 없음 | IP-Adapter 없이 순수 인페인팅 (Pre-paste와 함께 사용) |
| Standard | 낮음 | 중간 | CLIP만 사용, 일반적인 이미지 특징 |
| FaceID | 높음 | 낮음 | InsightFace 임베딩만 사용 |
| **FaceID Plus v2** | 높음 | 높음 | InsightFace + CLIP 결합 **(권장)** |
| CLIP Blend | 중간 | 높음 | 가중치 기반 CLIP 임베딩 블렌딩 |

### Pre-paste 파라미터

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `use_pre_paste` | bool | false | Pre-paste 모드 활성화 |
| `pre_paste_denoising` | 0.0-1.0 | 0.65 | 붙여넣기 후 디노이징 강도 (낮을수록 원본 유지) |

### POST-PROCESSING 파라미터

#### Face Swap

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `use_face_swap` | bool | false | Face Swap 활성화 |
| `face_swap_model` | string | "insightface" | 모델 선택 ("insightface", "ghost") |
| `use_swap_refinement` | bool | false | Face Swap 후 블렌딩 인페인팅 |
| `swap_refinement_strength` | 0.0-1.0 | 0.3 | 블렌딩 인페인팅 강도 |

#### Face Enhance

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `use_face_enhance` | bool | false | GFPGAN 얼굴 향상 활성화 |
| `face_enhance_strength` | 0.0-1.0 | 0.8 | 향상 강도 (1.0 = 최대 복원) |

---

## 팀원

| 홍지연 (팀장) | 임병건 |
| :---: | :---: |
| <img src="https://avatars.githubusercontent.com/hongjiyeon56" width="150px" alt="Jiyeon Hong" /> | <img src="https://avatars.githubusercontent.com/byungkun0823" width="150px" alt="Byungkun Lim" /> |
| [GitHub: @hongjiyeon56](https://github.com/hongjiyeon56) | [GitHub: @byungkun0823](https://github.com/byungkun0823) |

| 이성민 | 최서연 |
| :---: | :---: |
| <img src="https://avatars.githubusercontent.com/danlee-dev" width="150px" alt="Seongmin Lee" /> | <img src="https://avatars.githubusercontent.com/seoyeon-eo" width="150px" alt="Seoyeon Choi" /> |
| [GitHub: @danlee-dev](https://github.com/danlee-dev) | [GitHub: @seoyeon-eo](https://github.com/seoyeon-eo) |

---

## 라이선스

이 프로젝트는 MIT 라이선스를 따른다.

---

## 참고 문헌

- [IP-Adapter](https://github.com/tencent-ailab/IP-Adapter) - Tencent AI Lab
- [RealVisXL V4.0](https://huggingface.co/OzzyGT/RealVisXL_V4.0_inpainting) - Photorealistic SDXL Inpainting
- [SDXL Inpainting](https://huggingface.co/diffusers/stable-diffusion-xl-1.0-inpainting-0.1) - Stability AI
- [InsightFace](https://github.com/deepinsight/insightface) - Face Analysis & Swap
- [GFPGAN](https://github.com/TencentARC/GFPGAN) - Face Restoration
- [BiSeNet](https://github.com/zllrunning/face-parsing.PyTorch) - Face Parsing
- [Diffusers](https://github.com/huggingface/diffusers) - Hugging Face
- [Gemini API](https://ai.google.dev/) - Google AI

---

## 기술 스택

### Environment

![Visual Studio Code](https://img.shields.io/badge/Visual%20Studio%20Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

### AI / ML

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)

### AI Models

![SDXL](https://img.shields.io/badge/SDXL-Inpainting-blue?style=for-the-badge)
![IP-Adapter](https://img.shields.io/badge/IP--Adapter-FaceID%20Plus%20v2-green?style=for-the-badge)
![BiSeNet](https://img.shields.io/badge/BiSeNet-Face%20Parsing-orange?style=for-the-badge)
![InsightFace](https://img.shields.io/badge/InsightFace-Face%20Swap-red?style=for-the-badge)
![GFPGAN](https://img.shields.io/badge/GFPGAN-Face%20Enhance-FF6B6B?style=for-the-badge)
![CLIP](https://img.shields.io/badge/CLIP-ViT--H%2F14-9B59B6?style=for-the-badge)
![Google Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)

### Backend

![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-499848?style=for-the-badge&logo=gunicorn&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![Alembic](https://img.shields.io/badge/Alembic-000000?style=for-the-badge)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

### Frontend

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

### Database

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

### Infrastructure

![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
