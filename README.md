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
  <img src="https://img.shields.io/badge/InsightFace-Face%20Embedding-red?style=for-the-badge" alt="InsightFace" />
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

레퍼런스 이미지(배경/포즈 유지), 얼굴 이미지(정체성 주입), 프롬프트(텍스트 가이드)를 입력받아 IP-Adapter + SDXL Inpainting을 통해 최종 결과를 생성한다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **배경 완벽 보존** | 인페인팅 마스크가 얼굴 영역만 타겟팅하여 배경 유지 |
| **정체성 보존** | IP-Adapter FaceID Plus v2가 InsightFace 임베딩과 CLIP 특징 결합 |
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

**구성 가능한 옵션:**

- **IP-Adapter 모드**: Standard, FaceID, FaceID Plus v2 (권장), CLIP Blend 중 선택
- **Diffusion 설정**: Steps, Guidance Scale, Denoise Strength, Face Strength, Stop At
- **Mask 설정**: Include Hair, Include Neck, Expand 비율, Blur, Padding

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

파이프라인은 크게 입력 처리, 마스크 생성, 임베딩 추출, 디퓨전 생성의 4단계로 구성된다.

**1단계 - 입력 처리**: 레퍼런스 이미지(배경/포즈), 얼굴 이미지(정체성 소스), 프롬프트(텍스트 설명)를 로드한다.

**2단계 - 얼굴 감지 및 파싱**: OpenCV 또는 MediaPipe로 레퍼런스 이미지에서 얼굴 영역과 랜드마크를 감지한다. 이후 BiSeNet이 얼굴을 19개 클래스로 세그멘테이션하여 피부, 눈, 코, 입술, 머리카락, 목 등의 영역을 정밀하게 분리한다.

**3단계 - 마스크 생성**: 세그멘테이션 결과에서 바이너리 마스크를 생성하고, 설정에 따라 확장(expand), 블러(blur), 패딩(padding)을 적용한다. 이 마스크가 인페인팅 영역을 정의한다.

**4단계 - 임베딩 추출**: 얼굴 이미지에서 InsightFace가 512차원 얼굴 임베딩(정체성)을 추출하고, CLIP ViT-H가 257x1280 이미지 임베딩(스타일)을 추출한다.

**5단계 - IP-Adapter 주입**: 얼굴 임베딩과 CLIP 임베딩을 결합하여 SDXL의 어텐션 레이어에 주입한다. FaceID Plus v2 모드에서 두 임베딩이 동시에 사용되어 정체성과 스타일을 모두 보존한다.

**6단계 - SDXL Inpainting**: 마스크 영역만 디노이즈하면서 배경을 완벽히 보존한다. Stop-At 파라미터를 적용하여 설정된 비율에서 FaceID 영향을 중단하고 프롬프트 영향력을 높인다.

**7단계 - 출력**: 최종 합성 결과를 생성하고 WebSocket을 통해 실시간 진행 상황을 업데이트한다.

### 모델 구성

| 모델 | 용도 | 크기 |
|------|------|------|
| SDXL Inpainting | 기본 디퓨전 모델 | ~6GB |
| IP-Adapter FaceID Plus v2 | 얼굴 정체성 주입 | ~100MB |
| CLIP ViT-H/14 | 이미지 임베딩 추출 | ~2GB |
| InsightFace (antelopev2) | 얼굴 임베딩 추출 | ~300MB |
| BiSeNet | 얼굴 파싱/세그멘테이션 | ~50MB |
| Gemini 2.5 Flash | 자동 프롬프트 생성 (API) | Cloud |

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

### 방법 A: Runpod GPU 환경 (권장)

> **테스트 환경**: Runpod GPU Pod (A100 PCIe 2x, 63 vCPU, 235GB RAM, runpod-torch-v240 템플릿)
>
> Runpod은 Docker 컨테이너 내에서 실행되므로 Docker-in-Docker가 불가능합니다. 따라서 PostgreSQL과 Redis를 직접 설치합니다.

#### (선택) 개발 환경 설정

> **선택 사항**: Runpod 환경을 보다 편리하게 사용하고 싶다면, Claude Code와 Oh My Zsh 등 개발 도구를 자동으로 설치할 수 있습니다.

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

```bash
# 모든 서비스 한 번에 시작
bash scripts/start_all.sh

# 또는 개별 시작
bash scripts/start_backend.sh   # 백엔드만
bash scripts/start_frontend.sh  # 프론트엔드만
bash scripts/start_celery.sh    # Celery 워커만
```

#### 실시간 로그 모니터링 (tmux 분할 화면)

모든 서비스의 로그를 실시간으로 동시에 확인하려면 tmux 스크립트를 사용합니다:

```bash
bash scripts/start_all_tmux.sh
```

4개의 분할 창이 생성됩니다:

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

> **Mac 사용자 참고**: Mac에서 `Ctrl+B` → `방향키` 조합이 작동하지 않는 경우 (창이 사라지는 현상), 다음 대안을 사용하세요:
>
> | 키 조합 | 동작 |
> |---------|------|
> | `Ctrl+B` → `q` → `숫자` | 창 번호가 표시되면 해당 숫자 입력으로 이동 |
> | `Ctrl+B` → `o` | 다음 창으로 순환 이동 |
> | `Ctrl+B` → `;` | 이전 창으로 이동 |
>
> **마우스 지원 활성화** (권장):
> ```bash
> # 현재 세션에서 마우스 지원 활성화
> tmux set -g mouse on
> ```
> 마우스 지원을 활성화하면 클릭으로 창 선택, 스크롤로 로그 확인이 가능합니다.

**tmux 명령어:**

```bash
tmux attach -t ip-to-portrait    # 분리된 세션에 다시 연결
tmux kill-session -t ip-to-portrait  # 세션 종료 (모든 서비스 중단)
```

#### 다중 GPU 병렬 처리 (A100 2x 등)

여러 GPU가 있는 환경에서 진정한 병렬 처리를 하려면 각 GPU마다 별도의 Celery 워커를 실행해야 합니다.

```bash
# 자동으로 GPU 개수 감지하여 워커 시작
bash scripts/start_celery_multi_gpu.sh

# 또는 GPU 개수 직접 지정
GPU_COUNT=2 bash scripts/start_celery_multi_gpu.sh
```

**로그 확인:**
```bash
# GPU 0 워커 로그
tail -f /tmp/celery_gpu0.log

# GPU 1 워커 로그
tail -f /tmp/celery_gpu1.log
```

**모든 워커 종료:**
```bash
pkill -f 'celery -A tasks worker'
```

> **참고**: 프론트엔드에서 "Parallel" 체크박스를 활성화해야 병렬 처리가 적용됩니다.
> 단일 워커만 실행 중이면 병렬 체크와 관계없이 순차 처리됩니다.

---

#### Runpod 포트 포워딩 설정

Runpod 대시보드에서 다음 포트를 포워딩해야 합니다:
- **3008**: 프론트엔드 (Next.js)
- **8008**: 백엔드 (FastAPI)

Runpod Connect 메뉴에서 "Expose HTTP Ports" 옵션으로 설정하거나, SSH 터널링을 사용하세요.

#### Runpod 재시작 시 venv 재생성

Runpod Pod을 재시작하면 워크스페이스 경로가 변경될 수 있습니다 (예: `/root/...` → `/workspace/...`).
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
| SDXL Inpainting | ~6GB | `~/.cache/huggingface/` |
| IP-Adapter FaceID Plus v2 | ~100MB | `~/.cache/huggingface/` |
| CLIP ViT-H/14 | ~2GB | `~/.cache/huggingface/` |
| InsightFace (antelopev2) | ~300MB | `~/.insightface/models/` |
| BiSeNet | ~50MB | 프로젝트 내 자동 다운로드 |

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
| `steps` | 1-100 | 50 | 50 | 디퓨전 스텝 수 |
| `guidance_scale` | 1-20 | 7.5 | 2.5-4.0 | CFG 스케일 - 낮을수록 자연스러움 |
| `denoise_strength` | 0.0-1.0 | 0.92 | 0.85 | 생성 강도 - 높을수록 더 많이 재생성 |
| `face_strength` | 0.0-1.5 | 0.85 | 0.80 | 정체성을 위한 IP-Adapter 스케일 |
| `stop_at` | 0.0-1.0 | 1.0 | 0.7 | FaceID 영향 중단 시점 |

### Mask 파라미터

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `include_hair` | bool | true | 마스크에 머리카락 영역 포함 |
| `include_neck` | bool | false | 마스크에 목 영역 포함 |
| `mask_expand` | 0.0-1.0 | 0.3 | 마스크 확장 비율 |
| `mask_blur` | 0-50 | 15 | 마스크 경계 블러 (픽셀) |
| `mask_padding` | -50-50 | 10 | 추가 마스크 확장/축소 |

### IP-Adapter 모드

| 모드 | 정체성 | 스타일 | 설명 |
|------|--------|--------|------|
| Standard | 낮음 | 중간 | CLIP만 사용, 일반적인 이미지 특징 |
| FaceID | 높음 | 낮음 | InsightFace 임베딩만 사용 |
| **FaceID Plus v2** | 높음 | 높음 | InsightFace + CLIP 결합 (권장) |
| CLIP Blend | 중간 | 높음 | 가중치 기반 픽셀 레벨 블렌딩 |

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
- [SDXL Inpainting](https://huggingface.co/diffusers/stable-diffusion-xl-1.0-inpainting-0.1) - Stability AI
- [InsightFace](https://github.com/deepinsight/insightface) - Face Analysis
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
![InsightFace](https://img.shields.io/badge/InsightFace-antelopev2-red?style=for-the-badge)
![CLIP](https://img.shields.io/badge/CLIP-ViT--H%2F14-purple?style=for-the-badge)
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
