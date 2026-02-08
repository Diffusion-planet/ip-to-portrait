"""
Inpainting Pipeline for Face Composition
자동 얼굴 합성 - 마스크 자동 생성 (머리카락 포함)
필요한 것: 배경 이미지 + 합성할 얼굴 이미지 (2개만!)

v2: BiSeNet 기반 face+hair 마스킹 추가
v3: IP-Adapter FaceID 지원 (정체성 보존)
v4: Dual IP-Adapter 시도 (실패 - diffusers 한계)
v5: CLIP Blending 모드 추가 - 얼굴/머리카락 CLIP 임베딩 블렌딩
"""

import torch
import gc
from diffusers import AutoPipelineForInpainting
from PIL import Image, ImageFilter, ImageOps
import numpy as np
import cv2
import argparse
import os
import shutil
import sys
import random
from datetime import datetime


def cleanup_gpu_memory():
    """GPU 메모리 정리 - 생성 완료 후 호출"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    gc.collect()


def get_input_path(input_path: str) -> str:
    """입력 경로 처리 - inputs/ 폴더 자동 확인

    파일이 현재 위치에 없으면 inputs/ 폴더에서 찾음
    """
    # 이미 존재하면 그대로 사용
    if os.path.exists(input_path):
        return input_path

    # 절대 경로면 그대로 반환
    if os.path.isabs(input_path):
        return input_path

    # 스크립트 위치 기준으로 inputs 폴더 확인
    script_dir = os.path.dirname(os.path.abspath(__file__))
    inputs_dir = os.path.join(script_dir, "inputs")
    inputs_path = os.path.join(inputs_dir, input_path)

    if os.path.exists(inputs_path):
        return inputs_path

    # 못 찾으면 원본 경로 반환 (에러는 나중에 처리)
    return input_path


def setup_run_folder(run_name: str = None) -> str:
    """실행 폴더 생성

    각 실행마다 하나의 폴더가 생성됨:
    - outputs/run_name_timestamp/ 또는
    - outputs/timestamp/ (run_name 미지정시)

    Returns:
        폴더 경로
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    outputs_dir = os.path.join(script_dir, "outputs")

    # 타임스탬프 생성 (YYYYMMDD_HHMMSS)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 폴더명 결정
    if run_name:
        # 확장자 제거 (사용자가 .png 등을 붙였을 경우)
        if '.' in run_name:
            run_name = run_name.rsplit('.', 1)[0]
        folder_name = f"{run_name}_{timestamp}"
    else:
        folder_name = f"run_{timestamp}"

    run_folder = os.path.join(outputs_dir, folder_name)
    os.makedirs(run_folder, exist_ok=True)

    return run_folder


def save_run_params(run_folder: str, args, command: str, actual_seed: int,
                    background_path: str, face_path: str, actual_prompt: str = None):
    """실행 파라미터를 텍스트 파일로 저장

    Args:
        run_folder: 실행 폴더 경로
        args: argparse 결과
        command: 실제 실행한 명령어
        actual_seed: 실제 사용된 시드 (랜덤 생성된 경우 포함)
        background_path: 배경 이미지 경로
        face_path: 얼굴 이미지 경로
        actual_prompt: 실제 사용된 프롬프트 (auto-prompt 시 생성된 프롬프트)
    """
    params_path = os.path.join(run_folder, "params.txt")

    with open(params_path, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("Inpainting Pipeline - Run Parameters\n")
        f.write("=" * 70 + "\n\n")

        # 실행 시간
        f.write(f"실행 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        # 실제 명령어
        f.write("[ 실행 명령어 ]\n")
        f.write(f"{command}\n\n")

        # 입력 파일
        f.write("[ 입력 파일 ]\n")
        f.write(f"배경 이미지: {background_path}\n")
        f.write(f"얼굴 이미지: {face_path}\n\n")

        # 모든 파라미터
        f.write("[ 파라미터 ]\n")
        f.write(f"seed: {actual_seed}  # 재현에 필수!\n")
        f.write(f"face_strength: {args.face_strength}\n")
        f.write(f"denoising: {args.denoising}\n")
        f.write(f"guidance: {args.guidance}\n")
        f.write(f"steps: {args.steps}\n")
        f.write(f"mask_expand: {args.mask_expand}\n")
        f.write(f"mask_blur: {args.mask_blur}\n")
        f.write(f"mask_padding: {args.mask_padding}\n")
        # 실제 사용된 프롬프트 저장 (auto-prompt면 생성된 것, 아니면 원본)
        used_prompt = actual_prompt if actual_prompt else args.prompt
        f.write(f"prompt: {used_prompt}\n\n")

        # 모드 설정
        f.write("[ 모드 설정 ]\n")
        f.write(f"use_faceid: {args.use_faceid}\n")
        f.write(f"use_faceid_plus: {args.use_faceid_plus}\n")
        f.write(f"use_dual_adapter: {args.use_dual_adapter}\n")
        f.write(f"use_clip_blend: {args.use_clip_blend}\n")
        f.write(f"detection: {args.detection}\n")
        f.write(f"no_bisenet: {args.no_bisenet}\n")
        f.write(f"no_hair: {args.no_hair}\n")
        f.write(f"include_neck: {args.include_neck}\n")
        f.write(f"no_gender_detect: {args.no_gender_detect}\n")
        f.write(f"use_background_size: {args.use_background_size}\n")
        f.write(f"stop_at: {args.stop_at}\n")
        f.write(f"auto_prompt: {args.auto_prompt}\n\n")

        # CLIP Blending 파라미터
        f.write("[ CLIP Blending ]\n")
        f.write(f"face_blend_weight: {args.face_blend_weight}\n")
        f.write(f"hair_blend_weight: {args.hair_blend_weight}\n")
        f.write(f"shortcut_scale: {args.shortcut_scale}\n\n")

        # 재현 명령어
        f.write("=" * 70 + "\n")
        f.write("[ 재현 명령어 ]\n")
        f.write("=" * 70 + "\n")
        reproduce_cmd = (
            f"python inpainting-pipeline.py {os.path.basename(background_path)} {os.path.basename(face_path)} "
            f"--face-strength {args.face_strength} "
            f"--denoising {args.denoising} "
            f"--guidance {args.guidance} "
            f"--steps {args.steps} "
            f"--mask-padding {args.mask_padding} "
            f"--seed {actual_seed} "
            f"--prompt \"{args.prompt}\""
        )
        if args.use_faceid_plus:
            reproduce_cmd += " --use-faceid-plus"
        elif args.use_faceid:
            reproduce_cmd += " --use-faceid"
        if args.no_gender_detect:
            reproduce_cmd += " --no-gender-detect"
        if args.no_hair:
            reproduce_cmd += " --no-hair"
        if args.include_neck:
            reproduce_cmd += " --include-neck"
        if args.stop_at < 1.0:
            reproduce_cmd += f" --stop-at {args.stop_at}"
        if args.auto_prompt:
            reproduce_cmd += " --auto-prompt"
        if hasattr(args, 'use_pre_paste') and args.use_pre_paste:
            reproduce_cmd += " --use-pre-paste"
            reproduce_cmd += f" --pre-paste-denoising {args.pre_paste_denoising}"
        if hasattr(args, 'use_face_swap') and args.use_face_swap:
            reproduce_cmd += " --use-face-swap"
            if hasattr(args, 'face_swap_model'):
                reproduce_cmd += f" --face-swap-model {args.face_swap_model}"
        if hasattr(args, 'use_face_enhance') and args.use_face_enhance:
            reproduce_cmd += " --use-face-enhance"
            reproduce_cmd += f" --face-enhance-strength {args.face_enhance_strength}"
        if hasattr(args, 'use_swap_refinement') and args.use_swap_refinement:
            reproduce_cmd += " --use-swap-refinement"
            reproduce_cmd += f" --swap-refinement-strength {args.swap_refinement_strength}"

        f.write(f"{reproduce_cmd}\n")

    print(f"   파라미터 저장: {params_path}")

# BiSeNet face parser (optional, for hair-inclusive masks)
try:
    from face_parsing import FaceParser
    HAS_FACE_PARSER = True
except ImportError:
    HAS_FACE_PARSER = False
    print("face_parsing.py not found. BiSeNet hair masking unavailable.")

# FaceID module (optional, for better identity preservation)
try:
    print("[DEBUG inpainting-pipeline.py] Attempting to import face_id module...")
    print(f"[DEBUG inpainting-pipeline.py] sys.path: {__import__('sys').path[:3]}")
    print(f"[DEBUG inpainting-pipeline.py] __file__: {__file__}")
    from face_id import FaceIDExtractor, FaceIDIPAdapter, FaceSwapper, FaceEnhancer, check_insightface_available, HAS_GFPGAN, get_face_swapper
    print("[DEBUG inpainting-pipeline.py] ✅ face_id module imported successfully!")
    HAS_FACEID = check_insightface_available()
    HAS_FACESWAP = HAS_FACEID  # FaceSwap requires InsightFace
    HAS_FACE_ENHANCE = HAS_GFPGAN  # Face Enhance requires GFPGAN
    print(f"[DEBUG inpainting-pipeline.py] check_insightface_available() = {HAS_FACEID}")
    print(f"[DEBUG inpainting-pipeline.py] HAS_GFPGAN = {HAS_GFPGAN}")
    if not HAS_FACEID:
        print("InsightFace not installed. FaceID mode unavailable.")
        print("Install: pip install insightface onnxruntime")
    if not HAS_GFPGAN:
        print("GFPGAN not installed. Face Enhance mode unavailable.")
        print("Install: pip install gfpgan")
except ImportError as e:
    HAS_FACEID = False
    HAS_FACESWAP = False
    HAS_FACE_ENHANCE = False
    print(f"[DEBUG inpainting-pipeline.py] ❌ face_id import failed: {e}")
    print("face_id.py not found. FaceID mode unavailable.")

# Gemini Vision 프롬프트 생성기 (optional)
try:
    from prompt_generator import generate_prompt_from_face_image
    HAS_PROMPT_GENERATOR = True
except ImportError:
    HAS_PROMPT_GENERATOR = False


def get_device():
    """사용 가능한 최적의 디바이스 반환"""
    if torch.cuda.is_available():
        return "cuda"
    elif torch.backends.mps.is_available():
        return "mps"
    else:
        return "cpu"


class AutoIDPhotoCompositor:
    """자동 얼굴 감지 + 합성 (머리카락 포함, FaceID 지원, CLIP Blending, Pre-paste, FaceSwap)"""

    def __init__(self, detection_method='opencv', use_bisenet=True, use_faceid=False,
                 use_dual_adapter=False, use_clip_blend=False, use_faceid_plus=False,
                 use_pre_paste=False, use_face_swap=False, use_face_enhance=False,
                 use_swap_refinement=False, no_ip_adapter=False, face_swap_model='insightface'):
        """
        파이프라인 초기화

        Args:
            detection_method: 'opencv' or 'mediapipe'
            use_bisenet: BiSeNet 사용 여부 (머리카락 마스킹)
            use_faceid: FaceID 모드 사용 여부 (정체성 보존 향상)
            use_dual_adapter: Dual IP-Adapter 모드 (FaceID + CLIP for hair transfer)
            use_clip_blend: CLIP Blending 모드 (얼굴+머리카락 CLIP 임베딩 블렌딩)
            use_pre_paste: Pre-paste 모드 (소스 얼굴을 미리 붙여넣기, denoising 낮춤)
            use_face_swap: Face Swap 모드 (생성 후 얼굴 교체)
            use_face_enhance: Face Enhance 모드 (GFPGAN으로 얼굴 화질 개선)
            use_swap_refinement: Face Swap Refinement 모드 (Face Swap 후 경미한 인페인팅으로 블렌딩)
            no_ip_adapter: IP-Adapter 없이 순수 인페인팅만 수행 (Pre-paste와 함께 사용 권장)
            face_swap_model: Face Swap 모델 선택 ('insightface' 빠름, 'ghost' 고화질)
        """
        print("=" * 70)
        print("Inpainting Pipeline v5")
        print("=" * 70)

        # 디바이스 감지
        self.device = get_device()
        print(f"디바이스: {self.device}")

        # 모드 설정
        self.no_ip_adapter = no_ip_adapter  # 순수 인페인팅 모드 (IP-Adapter 없음)
        print(f"[DEBUG __init__] no_ip_adapter = {no_ip_adapter}")
        print(f"[DEBUG __init__] HAS_FACEID = {HAS_FACEID}")
        print(f"[DEBUG __init__] use_faceid_plus argument = {use_faceid_plus}")

        # no_ip_adapter 모드면 모든 IP-Adapter 관련 기능 비활성화
        if no_ip_adapter:
            self.use_dual_adapter = False
            self.use_faceid = False
            self.use_faceid_plus = False
            self.use_clip_blend = False
            self.ip_adapter_mode = "none"
            print("📋 Simple Inpainting 모드 (IP-Adapter 없음)")
        else:
            # Dual adapter requires both FaceID and CLIP
            self.use_dual_adapter = use_dual_adapter and HAS_FACEID
            self.use_faceid = (use_faceid or use_dual_adapter or use_faceid_plus) and HAS_FACEID
            self.use_faceid_plus = use_faceid_plus and HAS_FACEID  # FaceID Plus v2 (얼굴+머리스타일)
            self.use_clip_blend = use_clip_blend  # CLIP Blending mode

            if self.use_clip_blend:
                self.ip_adapter_mode = "clip_blend"  # CLIP embedding blending
            elif self.use_faceid_plus:
                self.ip_adapter_mode = "faceid_plus"  # FaceID Plus v2 (InsightFace + CLIP)
            elif self.use_dual_adapter:
                self.ip_adapter_mode = "dual"  # FaceID + CLIP
            elif self.use_faceid:
                self.ip_adapter_mode = "faceid"
            else:
                self.ip_adapter_mode = "standard"

        self.use_pre_paste = use_pre_paste  # Pre-paste mode (소스 얼굴 미리 붙여넣기)
        self.use_face_swap = use_face_swap and HAS_FACESWAP  # Face Swap mode (생성 후 얼굴 교체)
        self.use_swap_refinement = use_swap_refinement  # Face Swap Refinement mode (Face Swap 후 경미한 인페인팅)
        print(f"[DEBUG __init__] self.use_faceid_plus = {self.use_faceid_plus}")
        print(f"[DEBUG __init__] self.use_pre_paste = {self.use_pre_paste}")
        print(f"[DEBUG __init__] self.use_face_swap = {self.use_face_swap}")
        print(f"[DEBUG __init__] self.use_swap_refinement = {self.use_swap_refinement}")

        if (use_faceid or use_dual_adapter) and not HAS_FACEID:
            print("FaceID 요청되었으나 InsightFace 미설치. Standard 모드로 전환.")

        # BiSeNet face parser 초기화 (머리카락 마스킹용)
        self.face_parser = None
        self.use_bisenet = use_bisenet and HAS_FACE_PARSER
        if self.use_bisenet:
            try:
                self.face_parser = FaceParser(device=self.device)
                print("BiSeNet face parser 준비 완료")
            except Exception as e:
                print(f"BiSeNet 초기화 실패: {e}")
                self.use_bisenet = False

        # FaceID extractor 초기화 (정체성 보존용)
        self.face_id_extractor = None
        if self.use_faceid:
            try:
                self.face_id_extractor = FaceIDExtractor(device=self.device)
                if self.face_id_extractor.load():
                    print("FaceID extractor 준비 완료 (InsightFace)")
                else:
                    print("FaceID 로딩 실패, Standard 모드로 전환")
                    self.use_faceid = False
                    self.ip_adapter_mode = "standard"
            except Exception as e:
                print(f"FaceID 초기화 실패: {e}")
                self.use_faceid = False
                self.ip_adapter_mode = "standard"

        # FaceSwapper 초기화 (생성 후 얼굴 교체용)
        # CPU에서 실행 - GPU 메모리 충돌 방지 (diffusion 모델이 GPU 점유)
        self.face_swapper = None
        self.face_swap_model = face_swap_model
        self.face_swap_model_name = None  # Actual model name for logging
        if self.use_face_swap:
            try:
                self.face_swapper = get_face_swapper(model=face_swap_model, device="cpu")  # 항상 CPU 사용
                if self.face_swapper.load():
                    # Check actual swapper type (Ghost may fall back to InsightFace)
                    swapper_class = type(self.face_swapper).__name__
                    if swapper_class == "GhostFaceSwapper":
                        self.face_swap_model_name = "Ghost (고화질)"
                    else:
                        # InsightFace - show actual model name
                        actual_model = getattr(self.face_swapper, '_model_name', 'inswapper_128')
                        self.face_swap_model_name = f"InsightFace ({actual_model})"
                        if face_swap_model == "ghost":
                            print("⚠️ Ghost 사용 불가, InsightFace로 폴백")
                    print(f"FaceSwapper 준비 완료 (CPU, {self.face_swap_model_name})")
                else:
                    print("FaceSwapper 로딩 실패, Face Swap 비활성화")
                    self.use_face_swap = False
            except Exception as e:
                print(f"FaceSwapper 초기화 실패: {e}")
                self.use_face_swap = False

        # FaceEnhancer 초기화 (얼굴 화질 개선용 - GFPGAN)
        # CPU에서 실행 - GPU 메모리 충돌 방지
        self.use_face_enhance = use_face_enhance and HAS_FACE_ENHANCE
        self.face_enhancer = None
        if self.use_face_enhance:
            try:
                self.face_enhancer = FaceEnhancer(device="cpu", upscale=1)  # upscale=1: 원본 크기 유지
                if self.face_enhancer.load():
                    print("FaceEnhancer 준비 완료 (CPU, GFPGAN v1.4)")
                else:
                    print("FaceEnhancer 로딩 실패, Face Enhance 비활성화")
                    self.use_face_enhance = False
            except Exception as e:
                print(f"FaceEnhancer 초기화 실패: {e}")
                self.use_face_enhance = False

        # dtype 설정 (CPU는 float32 사용)
        self.dtype = torch.float32 if self.device == "cpu" else torch.float16

        # Inpainting 파이프라인
        print("\nRealVisXL V4.0 Inpainting 모델 로딩 중...")
        self.pipeline = AutoPipelineForInpainting.from_pretrained(
            "OzzyGT/RealVisXL_V4.0_inpainting",
            torch_dtype=self.dtype,
            variant="fp16" if self.dtype == torch.float16 else None
        )

        # IP-Adapter 로드 (모드에 따라 다른 어댑터)
        # no_ip_adapter 모드면 IP-Adapter 로딩 건너뛰기
        if self.no_ip_adapter:
            self.has_ip_adapter = True  # 파이프라인은 사용 가능
            print("IP-Adapter 로딩 건너뜀 (Simple Inpainting 모드)")
        else:
            self.has_ip_adapter = self._load_ip_adapter()
            if not self.has_ip_adapter:
                return

        self.pipeline.to(self.device)

        # xFormers는 CUDA에서만 사용
        if self.device == "cuda":
            try:
                self.pipeline.enable_xformers_memory_efficient_attention()
                print("xFormers 메모리 최적화 활성화")
            except:
                pass

        # 얼굴 감지 초기화
        self.detection_method = detection_method
        self._init_face_detection()

        # 모드 정보 출력
        print(f"\n현재 모드: {self.ip_adapter_mode.upper()}")
        if self.no_ip_adapter:
            print("  - Simple Inpainting (IP-Adapter 없음)")
            print("  - 순수 인페인팅만 수행")
            print("  - Pre-paste와 함께 사용 시 얼굴 조화로운 블렌딩")
        elif self.use_clip_blend:
            print("  - CLIP Blending Mode")
            print("  - 얼굴/머리카락 영역 별도 CLIP 인코딩")
            print("  - 가중치 블렌딩으로 두 특성 동시 반영")
            print("  - 정체성 + 머리카락 스타일 전이")
        elif self.use_faceid_plus:
            print("  - IP-Adapter FaceID Plus v2")
            print("  - InsightFace 512-dim 얼굴 임베딩 (정체성)")
            print("  - CLIP 1024-dim 이미지 임베딩 (머리스타일)")
            print("  - 얼굴 + 머리스타일 동시 반영!")
        elif self.use_dual_adapter:
            print("  - Dual IP-Adapter (FaceID + CLIP)")
            print("  - InsightFace 512-dim 얼굴 임베딩 (정체성)")
            print("  - CLIP 머리카락 이미지 임베딩 (스타일)")
            print("  - 얼굴 정체성 + 머리카락 스타일 동시 전이")
        elif self.use_faceid:
            print("  - IP-Adapter FaceID (InsightFace)")
            print("  - InsightFace 512-dim 얼굴 임베딩 사용")
            print("  - 정체성 보존 향상 (머리스타일 미반영)")
        else:
            print("  - Standard IP-Adapter")
            print("  - CLIP 임베딩만 사용")
            print("  - 정체성 보존 제한적")

        # 추가 모드 정보
        if self.use_pre_paste:
            print("\n📋 Pre-paste 모드 활성화")
            print("  - 소스 얼굴을 배경에 미리 붙여넣기")
            print("  - Denoising strength 자동 조정 (~0.65)")
            print("  - 얼굴 위치/크기 더 정확하게 유지")
        if self.use_face_swap:
            print("\n🔄 Face Swap 모드 활성화")
            model_display = self.face_swap_model_name or self.face_swap_model
            print(f"  - 생성 후 {model_display} 적용")
            print("  - 얼굴 유사도 향상")
        print("=" * 70)

    def _load_ip_adapter(self) -> bool:
        """IP-Adapter 로드 (모드에 따라 Standard, FaceID, Dual, 또는 CLIP Blend)"""
        try:
            if self.use_clip_blend:
                # CLIP Blending: Standard IP-Adapter 로드 + CLIP 인코더 저장
                print("CLIP Blending 모드: Standard IP-Adapter 로딩 중...")
                self.pipeline.load_ip_adapter(
                    "h94/IP-Adapter",
                    subfolder="sdxl_models",
                    weight_name="ip-adapter_sdxl.bin"
                )
                # CLIP 인코더 저장 (수동 임베딩 추출용)
                self.clip_image_encoder = self.pipeline.image_encoder
                self.clip_image_processor = self.pipeline.feature_extractor
                print("CLIP Blending: Standard IP-Adapter + CLIP 인코더 준비 완료!")

            elif self.use_dual_adapter:
                # Dual IP-Adapter: Standard (머리카락 CLIP) + FaceID (얼굴)
                # diffusers는 리스트로 multiple IP-Adapter 로딩 지원
                print("Dual IP-Adapter 로딩 중 (Standard + FaceID)...")

                # 두 어댑터를 한 번에 로드 (리스트 형식)
                self.pipeline.load_ip_adapter(
                    ["h94/IP-Adapter", "h94/IP-Adapter-FaceID"],
                    subfolder=["sdxl_models", ""],
                    weight_name=["ip-adapter_sdxl.bin", "ip-adapter-faceid_sdxl.bin"],
                )
                print("  [1] Standard IP-Adapter (CLIP) 로딩")
                print("  [2] IP-Adapter FaceID 로딩")

                # CLIP image encoder 저장
                self.clip_image_encoder = self.pipeline.image_encoder
                self.clip_image_processor = self.pipeline.feature_extractor

                # 두 어댑터의 스케일 설정 [Standard(hair), FaceID(face)]
                self.pipeline.set_ip_adapter_scale([0.3, 0.6])
                print("Dual IP-Adapter 로딩 완료! (scales: hair=0.3, face=0.6)")

            elif self.use_faceid_plus:
                # FaceID Plus v2: InsightFace + CLIP 이미지 임베딩 (머리스타일 포함)
                print("IP-Adapter FaceID Plus v2 로딩 중...")

                # CLIP 이미지 인코더 로드 (Plus v2 필수)
                from transformers import CLIPVisionModelWithProjection
                self.clip_image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                    "laion/CLIP-ViT-H-14-laion2B-s32B-b79K",
                    torch_dtype=self.dtype,
                ).to(self.device)
                print("  CLIP 이미지 인코더 로드 완료")

                # IP-Adapter FaceID Plus v2 로드
                self.pipeline.load_ip_adapter(
                    "h94/IP-Adapter-FaceID",
                    subfolder="",
                    weight_name="ip-adapter-faceid-plusv2_sdxl.bin",
                    image_encoder_folder=None,  # 이미 별도로 로드함
                )

                # shortcut 설정 (Plus v2 필수)
                self.pipeline.unet.encoder_hid_proj.image_projection_layers[0].shortcut = True
                print("IP-Adapter FaceID Plus v2 로딩 완료! (얼굴+머리스타일)")
            elif self.use_faceid:
                # FaceID (non-Plus): InsightFace 임베딩만 사용
                print("IP-Adapter FaceID 로딩 중...")
                self.pipeline.load_ip_adapter(
                    "h94/IP-Adapter-FaceID",
                    subfolder="",
                    weight_name="ip-adapter-faceid_sdxl.bin",
                    image_encoder_folder=None,
                )
                print("IP-Adapter FaceID 로딩 완료!")
            else:
                # Standard IP-Adapter (CLIP only)
                print("Standard IP-Adapter 로딩 중...")
                self.pipeline.load_ip_adapter(
                    "h94/IP-Adapter",
                    subfolder="sdxl_models",
                    weight_name="ip-adapter_sdxl.bin"
                )
                # CLIP 인코더 저장 (Standard 모드에서도 필요)
                self.clip_image_encoder = self.pipeline.image_encoder
                self.clip_image_processor = self.pipeline.feature_extractor
                print("Standard IP-Adapter 로딩 완료!")
            return True
        except Exception as e:
            print(f"IP-Adapter 로딩 실패: {e}")
            import traceback
            traceback.print_exc()
            return False

    def switch_to_faceid(self, scale: float = 0.85) -> bool:
        """
        FaceID 모드로 전환 (런타임 전환)

        Args:
            scale: IP-Adapter scale

        Returns:
            성공 여부
        """
        if not HAS_FACEID:
            print("InsightFace가 설치되지 않았습니다.")
            return False

        if self.ip_adapter_mode == "faceid":
            print("이미 FaceID 모드입니다.")
            return True

        try:
            # FaceID extractor 초기화
            if self.face_id_extractor is None:
                self.face_id_extractor = FaceIDExtractor(device=self.device)
                if not self.face_id_extractor.load():
                    return False

            # IP-Adapter 교체 (FaceID)
            print("IP-Adapter FaceID로 전환 중...")
            self.pipeline.load_ip_adapter(
                "h94/IP-Adapter-FaceID",
                subfolder="",
                weight_name="ip-adapter-faceid_sdxl.bin",
            )
            self.pipeline.set_ip_adapter_scale(scale)

            self.use_faceid = True
            self.ip_adapter_mode = "faceid"
            print("FaceID Plus v2 모드로 전환 완료!")
            return True

        except Exception as e:
            print(f"FaceID 전환 실패: {e}")
            return False

    def switch_to_standard(self, scale: float = 0.85) -> bool:
        """
        Standard 모드로 전환 (런타임 전환)

        Args:
            scale: IP-Adapter scale

        Returns:
            성공 여부
        """
        if self.ip_adapter_mode == "standard":
            print("이미 Standard 모드입니다.")
            return True

        try:
            print("Standard IP-Adapter로 전환 중...")
            self.pipeline.load_ip_adapter(
                "h94/IP-Adapter",
                subfolder="sdxl_models",
                weight_name="ip-adapter_sdxl.bin"
            )
            self.pipeline.set_ip_adapter_scale(scale)

            self.use_faceid = False
            self.ip_adapter_mode = "standard"
            print("Standard 모드로 전환 완료!")
            return True

        except Exception as e:
            print(f"Standard 전환 실패: {e}")
            return False

    def get_current_mode(self) -> str:
        """현재 IP-Adapter 모드 반환"""
        return self.ip_adapter_mode

    def _pre_paste_face(
        self,
        background_img: Image.Image,
        source_face_img: Image.Image,
        target_bbox: tuple = None,
        blend_mode: str = "seamless",
        run_folder: str = None
    ) -> Image.Image:
        """
        소스 얼굴을 배경 이미지에 미리 붙여넣기 (Pre-paste)

        Inpainting 전에 소스 얼굴을 배경의 얼굴 위치에 미리 붙여넣어서
        얼굴 위치와 크기를 더 정확하게 유지합니다.

        Args:
            background_img: 배경 이미지 (PIL Image)
            source_face_img: 소스 얼굴 이미지 (PIL Image)
            target_bbox: 타겟 얼굴 영역 (x1, y1, x2, y2), None이면 자동 감지
            blend_mode: 블렌딩 모드 ("seamless", "alpha", "direct")
            run_folder: 중간 결과 저장 폴더 (디버깅용)

        Returns:
            소스 얼굴이 붙여넣어진 이미지 (PIL Image)
        """
        print("\n📋 Pre-paste: 소스 얼굴 미리 붙여넣기...")

        # 디버깅: 소스 얼굴 저장
        if run_folder:
            src_path = os.path.join(run_folder, "2.1_prepaste_source_face.png")
            source_face_img.save(src_path)
            print(f"   Pre-paste 소스 얼굴 저장: {os.path.basename(src_path)}")

        bg_array = np.array(background_img)
        src_array = np.array(source_face_img)

        # 배경에서 타겟 얼굴 위치 감지
        if target_bbox is None:
            bg_bgr = bg_array[:, :, ::-1]
            if self.face_cascade is not None:
                gray = cv2.cvtColor(bg_bgr, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
                if len(faces) > 0:
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    # 얼굴 영역 확장 (머리카락 포함)
                    expand = 0.5
                    x1 = max(0, int(x - w * expand))
                    y1 = max(0, int(y - h * expand * 1.2))  # 위쪽 더 확장 (이마/머리)
                    x2 = min(bg_array.shape[1], int(x + w + w * expand))
                    y2 = min(bg_array.shape[0], int(y + h + h * expand * 0.5))
                    target_bbox = (x1, y1, x2, y2)
                    print(f"   타겟 얼굴 영역: {target_bbox}")

        if target_bbox is None:
            print("   ⚠️ 배경에서 얼굴을 찾지 못했습니다. Pre-paste 건너뜀.")
            return background_img

        x1, y1, x2, y2 = target_bbox
        target_w = x2 - x1
        target_h = y2 - y1

        # 디버깅: 타겟 영역 시각화 (배경에 박스 표시)
        if run_folder:
            target_vis = bg_array.copy()
            cv2.rectangle(target_vis, (x1, y1), (x2, y2), (0, 255, 0), 3)
            cv2.putText(target_vis, "Target Face Area", (x1, y1-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            target_vis_path = os.path.join(run_folder, "2.2_prepaste_target_area.png")
            Image.fromarray(target_vis).save(target_vis_path)
            print(f"   Pre-paste 타겟 영역 저장: {os.path.basename(target_vis_path)}")

        # 소스 얼굴에서 얼굴 영역 감지
        src_bgr = src_array[:, :, ::-1]
        src_bbox = None
        if self.face_cascade is not None:
            gray = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            if len(faces) > 0:
                sx, sy, sw, sh = max(faces, key=lambda f: f[2] * f[3])
                # 얼굴 영역 확장
                expand = 0.4
                sx1 = max(0, int(sx - sw * expand))
                sy1 = max(0, int(sy - sh * expand * 1.0))
                sx2 = min(src_array.shape[1], int(sx + sw + sw * expand))
                sy2 = min(src_array.shape[0], int(sy + sh + sh * expand * 0.3))
                src_bbox = (sx1, sy1, sx2, sy2)

        # 소스 얼굴 크롭 및 리사이즈
        if src_bbox:
            sx1, sy1, sx2, sy2 = src_bbox
            src_cropped = src_array[sy1:sy2, sx1:sx2]
        else:
            src_cropped = src_array

        # 타겟 크기에 맞게 리사이즈
        src_resized = cv2.resize(src_cropped, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

        # 디버깅: 크롭/리사이즈된 소스 얼굴 저장
        if run_folder:
            cropped_path = os.path.join(run_folder, "2.3_prepaste_source_cropped.png")
            Image.fromarray(src_cropped).save(cropped_path)
            print(f"   Pre-paste 크롭된 소스 저장: {os.path.basename(cropped_path)}")

            resized_path = os.path.join(run_folder, "2.4_prepaste_source_resized.png")
            Image.fromarray(src_resized).save(resized_path)
            print(f"   Pre-paste 리사이즈된 소스 저장: {os.path.basename(resized_path)}")

        # 블렌딩
        result = bg_array.copy()

        if blend_mode == "seamless":
            # OpenCV seamlessClone 사용
            try:
                # BiSeNet으로 정교한 마스크 생성 시도
                mask = None
                if self.use_bisenet and self.face_parser is not None:
                    try:
                        # 소스 얼굴 크롭 이미지에서 BiSeNet 마스크 생성
                        src_cropped_pil = Image.fromarray(src_cropped)
                        bisenet_mask = self.face_parser.get_face_hair_mask(
                            src_cropped_pil,
                            target_size=src_cropped_pil.size,  # 크롭 이미지 크기
                            include_hair=True,
                            include_neck=False,
                            blur_radius=0,  # 블러 없이 (나중에 별도로 적용)
                            expand_ratio=1.0  # 확장 없이 정확한 영역만
                        )
                        if bisenet_mask is not None:
                            # 마스크를 numpy 배열로 변환
                            bisenet_mask_array = np.array(bisenet_mask.convert('L'))

                            # 디버깅: BiSeNet 원본 마스크 저장 (리사이즈 전)
                            if run_folder:
                                raw_mask_path = os.path.join(run_folder, "2.5a_prepaste_bisenet_raw_mask.png")
                                Image.fromarray(bisenet_mask_array).save(raw_mask_path)
                                print(f"   BiSeNet 원본 마스크 저장: {os.path.basename(raw_mask_path)}")

                            # 타겟 크기에 맞게 리사이즈
                            mask = cv2.resize(bisenet_mask_array, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

                            # 디버깅: 리사이즈된 마스크 저장 (블러 전)
                            if run_folder:
                                resized_mask_path = os.path.join(run_folder, "2.5b_prepaste_mask_resized.png")
                                Image.fromarray(mask).save(resized_mask_path)
                                print(f"   리사이즈 마스크 저장: {os.path.basename(resized_mask_path)}")

                            # seamlessClone을 위해 완전 이진 마스크로 변환
                            # GaussianBlur는 seamlessClone에서 자체적으로 처리하므로 필요없음
                            _, mask = cv2.threshold(mask, 100, 255, cv2.THRESH_BINARY)

                            # 모폴로지 연산으로 가장자리 정리 (블러 대신)
                            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
                            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

                            # 완전 이진화 보장 (중간값 제거)
                            mask = np.where(mask >= 128, 255, 0).astype(np.uint8)
                            print(f"   BiSeNet 이진 마스크 생성: min={mask.min()}, max={mask.max()}, nonzero={np.count_nonzero(mask)}")
                    except Exception as e:
                        print(f"   BiSeNet 마스크 실패: {e}, 타원 마스크로 대체")
                        mask = None

                # BiSeNet 실패 시 기본 타원 마스크 사용
                if mask is None:
                    mask = np.zeros((target_h, target_w), dtype=np.uint8)
                    center = (target_w // 2, target_h // 2)
                    axes = (int(target_w * 0.45), int(target_h * 0.48))
                    cv2.ellipse(mask, center, axes, 0, 0, 360, 255, -1)
                    # 이미 완전 이진 마스크 (cv2.ellipse가 255로 채움)
                    print(f"   타원형 기본 마스크 사용: min={mask.min()}, max={mask.max()}")

                # 디버깅: 블렌딩 마스크 저장
                if run_folder:
                    mask_path = os.path.join(run_folder, "2.5_prepaste_blend_mask.png")
                    Image.fromarray(mask).save(mask_path)
                    print(f"   Pre-paste 블렌딩 마스크 저장: {os.path.basename(mask_path)}")

                # seamlessClone center 계산
                clone_center = (x1 + target_w // 2, y1 + target_h // 2)

                # BGR 변환
                result_bgr = result[:, :, ::-1].copy()
                src_resized_bgr = src_resized[:, :, ::-1]

                # seamlessClone용 완전 이진 마스크 확인 (이미 이진화됨)
                binary_mask = mask.copy()
                # 혹시 모르니 한번 더 이진화 보장
                binary_mask = np.where(binary_mask >= 128, 255, 0).astype(np.uint8)

                # 마스크 유효성 검사
                unique_vals = np.unique(binary_mask)
                nonzero_ratio = np.count_nonzero(binary_mask) / binary_mask.size
                print(f"   최종 마스크: 고유값={unique_vals}, 비율={nonzero_ratio:.2%}")

                if nonzero_ratio < 0.01:
                    print("   ⚠️ 마스크 영역이 너무 작음! 타원 마스크로 대체")
                    binary_mask = np.zeros((target_h, target_w), dtype=np.uint8)
                    center = (target_w // 2, target_h // 2)
                    axes = (int(target_w * 0.45), int(target_h * 0.48))
                    cv2.ellipse(binary_mask, center, axes, 0, 0, 360, 255, -1)

                # 디버깅: 최종 이진 마스크 저장
                if run_folder:
                    binary_mask_path = os.path.join(run_folder, "2.5c_prepaste_binary_mask.png")
                    Image.fromarray(binary_mask).save(binary_mask_path)
                    print(f"   최종 이진 마스크 저장: {os.path.basename(binary_mask_path)}")

                # Seamless clone
                print(f"   seamlessClone 호출: src={src_resized_bgr.shape}, dst={result_bgr.shape}, mask={binary_mask.shape}, center={clone_center}")
                result_bgr = cv2.seamlessClone(
                    src_resized_bgr, result_bgr, binary_mask,
                    clone_center, cv2.NORMAL_CLONE
                )
                result = result_bgr[:, :, ::-1]
                print("   ✅ Seamless clone 적용 완료 (불투명 합성)")

            except Exception as e:
                import traceback
                print(f"   ❌ Seamless clone 실패!")
                print(f"   에러: {e}")
                traceback.print_exc()
                print("   → alpha 블렌딩으로 대체 (그라디언트 마스크 사용)")
                blend_mode = "alpha"

        if blend_mode == "alpha":
            # Alpha 블렌딩 (그라디언트 마스크) - 반투명 효과 발생!
            print("   ⚠️ Alpha 블렌딩 사용 - 이 모드는 반투명 효과를 일으킬 수 있음!")

            # 그라디언트 대신 이진 마스크로 직접 합성 시도
            # 이렇게 하면 반투명 문제 해결됨
            mask = np.zeros((target_h, target_w), dtype=np.float32)
            center = (target_w // 2, target_h // 2)
            axes = (int(target_w * 0.45), int(target_h * 0.48))

            # 타원 마스크를 float로 생성 (1.0 = 불투명)
            mask_uint8 = np.zeros((target_h, target_w), dtype=np.uint8)
            cv2.ellipse(mask_uint8, center, axes, 0, 0, 360, 255, -1)
            # 가장자리만 아주 살짝 블러 (5픽셀)
            mask_uint8 = cv2.GaussianBlur(mask_uint8, (11, 11), 0)
            mask = mask_uint8.astype(np.float32) / 255.0
            mask_3d = mask[:, :, np.newaxis]

            # 블렌딩
            region = result[y1:y2, x1:x2].astype(np.float32)
            src_float = src_resized.astype(np.float32)
            blended = region * (1 - mask_3d) + src_float * mask_3d
            result[y1:y2, x1:x2] = blended.astype(np.uint8)
            print("   Alpha 블렌딩 적용 완료 (개선된 타원 마스크)")

        elif blend_mode == "direct":
            # 직접 붙여넣기
            result[y1:y2, x1:x2] = src_resized
            print("   직접 붙여넣기 완료")

        return Image.fromarray(result)

    def _apply_face_swap(
        self,
        result_image: Image.Image,
        source_face_img: Image.Image,
        run_folder: str = None
    ) -> Image.Image:
        """
        생성된 결과에 InsightFace Face Swap 적용

        Args:
            result_image: 생성된 결과 이미지 (PIL Image)
            source_face_img: 소스 얼굴 이미지 (PIL Image)
            run_folder: 중간 결과 저장 폴더 (디버깅용)

        Returns:
            Face swap이 적용된 이미지 (PIL Image)
        """
        if self.face_swapper is None:
            print("   ⚠️ FaceSwapper가 초기화되지 않았습니다.")
            return result_image

        # Use stored model name
        model_name = self.face_swap_model_name or self.face_swap_model
        print(f"\n🔄 Face Swap: {model_name} 적용 중...")

        # 디버깅: 소스 얼굴 저장
        if run_folder:
            src_path = os.path.join(run_folder, "6.0_faceswap_source.png")
            source_face_img.save(src_path)
            print(f"   Face Swap 소스 얼굴 저장: {os.path.basename(src_path)}")

        try:
            swapped = self.face_swapper.swap_face(result_image, source_face_img)
            if swapped is not None:
                print("   Face Swap 완료!")
                # 디버깅: Face Swap 결과 저장
                if run_folder:
                    swap_result_path = os.path.join(run_folder, "6.1_faceswap_result.png")
                    swapped.save(swap_result_path)
                    print(f"   Face Swap 결과 저장: {os.path.basename(swap_result_path)}")
                return swapped
            else:
                print("   ⚠️ Face Swap 실패, 원본 결과 반환")
                return result_image
        except Exception as e:
            print(f"   ⚠️ Face Swap 오류: {e}")
            return result_image

    def _apply_face_enhance(
        self,
        result_image: Image.Image,
        strength: float = 0.8,
        run_folder: str = None
    ) -> Image.Image:
        """
        GFPGAN으로 얼굴 화질 개선

        Args:
            result_image: 입력 이미지 (PIL Image)
            strength: 개선 강도 (0.0=원본, 1.0=완전 개선)
            run_folder: 중간 결과 저장 폴더 (디버깅용)

        Returns:
            화질 개선된 이미지 (PIL Image)
        """
        print("\n🔧 Face Enhance (GFPGAN) 적용 중...")

        if self.face_enhancer is None:
            print("   ⚠️ FaceEnhancer가 초기화되지 않음, 원본 반환")
            return result_image

        try:
            if strength >= 1.0:
                # 완전 개선
                enhanced = self.face_enhancer.enhance(result_image, only_center_face=True, paste_back=True)
            else:
                # 부분 블렌딩
                enhanced = self.face_enhancer.enhance_face_region(result_image, blend_ratio=strength)

            if enhanced is not None:
                print(f"   Face Enhance 완료! (강도: {strength:.0%})")
                # 디버깅: Face Enhance 결과 저장
                if run_folder:
                    enhance_result_path = os.path.join(run_folder, "6.2_face_enhance_result.png")
                    enhanced.save(enhance_result_path)
                    print(f"   Face Enhance 결과 저장: {os.path.basename(enhance_result_path)}")
                return enhanced
            else:
                print("   ⚠️ Face Enhance 실패, 원본 결과 반환")
                return result_image
        except Exception as e:
            print(f"   ⚠️ Face Enhance 오류: {e}")
            import traceback
            traceback.print_exc()
            return result_image

    def _apply_swap_refinement(
        self,
        swapped_image: Image.Image,
        prompt: str,
        denoising_strength: float = 0.3,
        guidance_scale: float = 7.5,
        num_steps: int = 20,
        seed: int = None,
        run_folder: str = None
    ) -> Image.Image:
        """
        Face Swap 후 얼굴 영역에 경미한 인페인팅으로 자연스럽게 블렌딩

        Face Swap은 얼굴을 교체하지만 경계가 부자연스러울 수 있음.
        이 메서드는 얼굴 영역에만 낮은 denoising으로 가볍게 인페인팅하여
        자연스러운 블렌딩을 달성함.

        Args:
            swapped_image: Face Swap이 적용된 이미지 (PIL Image)
            prompt: 인페인팅 프롬프트
            denoising_strength: Denoising 강도 (0.1~0.5 권장, 낮을수록 원본 유지)
            guidance_scale: 가이던스 스케일
            num_steps: 추론 스텝 수 (빠른 정제를 위해 적은 스텝 사용)
            seed: 랜덤 시드
            run_folder: 중간 결과 저장 폴더 (디버깅용)

        Returns:
            정제된 이미지 (PIL Image)
        """
        print(f"\n🔧 Face Swap Refinement 적용 중... (denoising: {denoising_strength:.2f})")

        # 파이프라인이 없으면 원본 반환
        if not self.has_ip_adapter and not self.no_ip_adapter:
            print("   ⚠️ 인페인팅 파이프라인이 없습니다.")
            return swapped_image

        # BiSeNet으로 얼굴 마스크 생성
        if self.face_parser is None:
            print("   ⚠️ BiSeNet이 없어 전체 이미지 리파인먼트를 수행합니다.")
            # BiSeNet이 없으면 간단한 중앙 영역 마스크 사용
            w, h = swapped_image.size
            mask = Image.new("L", (w, h), 0)
            # 중앙 60% 영역에 마스크
            margin_x = int(w * 0.2)
            margin_y = int(h * 0.15)
            for y in range(margin_y, h - margin_y):
                for x in range(margin_x, w - margin_x):
                    mask.putpixel((x, y), 255)
            mask = mask.filter(ImageFilter.GaussianBlur(radius=30))
        else:
            try:
                # BiSeNet으로 정확한 얼굴 마스크 생성 (얼굴만, 머리카락 제외)
                face_mask = self.face_parser.get_face_hair_mask(
                    swapped_image,
                    include_hair=False,  # 머리카락 제외 (얼굴만)
                    include_neck=False,
                    blur_radius=10,
                    expand_ratio=1.15  # 약간 확장
                )
                if face_mask is not None:
                    mask = face_mask
                else:
                    raise ValueError("BiSeNet failed to generate mask")
            except Exception as e:
                print(f"   ⚠️ 마스크 생성 실패: {e}, 중앙 영역 마스크 사용")
                w, h = swapped_image.size
                mask = Image.new("L", (w, h), 0)
                margin_x = int(w * 0.2)
                margin_y = int(h * 0.15)
                for y in range(margin_y, h - margin_y):
                    for x in range(margin_x, w - margin_x):
                        mask.putpixel((x, y), 255)
                mask = mask.filter(ImageFilter.GaussianBlur(radius=30))

        # 마스크 저장 (디버깅용)
        if run_folder:
            refinement_mask_path = os.path.join(run_folder, "6.3_swap_refinement_mask.png")
            mask.save(refinement_mask_path)
            print(f"   Refinement 마스크 저장: {os.path.basename(refinement_mask_path)}")

        # Generator 설정
        if seed is not None:
            generator = torch.Generator(device=self.device).manual_seed(seed)
        else:
            generator = None

        try:
            # IP-Adapter가 로드된 경우, 제로 임베딩 전달 (정제 시에는 IP-Adapter 영향 없이)
            pipeline_kwargs = {
                "prompt": prompt,
                "image": swapped_image,
                "mask_image": mask,
                "num_inference_steps": num_steps,
                "guidance_scale": guidance_scale,
                "strength": denoising_strength,
                "generator": generator,
            }

            # IP-Adapter가 로드된 상태면 임베딩 필요
            if self.has_ip_adapter:
                # IP-Adapter scale을 0으로 설정하여 영향 제거
                original_scale = self.pipeline.get_ip_adapter_scale() if hasattr(self.pipeline, 'get_ip_adapter_scale') else None
                self.pipeline.set_ip_adapter_scale(0.0)

                # 제로 임베딩 전달 (FaceID Plus v2: shape (2, 1, 512))
                zero_embedding = torch.zeros(2, 1, 512, dtype=self.dtype, device=self.device)
                pipeline_kwargs["ip_adapter_image_embeds"] = [zero_embedding]

            # 인페인팅 수행 (낮은 denoising으로 가벼운 정제)
            result = self.pipeline(**pipeline_kwargs)

            # IP-Adapter scale 복원
            if self.has_ip_adapter and original_scale is not None:
                self.pipeline.set_ip_adapter_scale(original_scale)

            refined_image = result.images[0]

            # 크기가 다르면 복원
            if refined_image.size != swapped_image.size:
                refined_image = refined_image.resize(swapped_image.size, Image.Resampling.LANCZOS)

            print(f"   Swap Refinement 완료!")

            # 결과 저장 (디버깅용)
            if run_folder:
                refinement_result_path = os.path.join(run_folder, "6.4_swap_refinement_result.png")
                refined_image.save(refinement_result_path)
                print(f"   Refinement 결과 저장: {os.path.basename(refinement_result_path)}")

            return refined_image

        except Exception as e:
            print(f"   ⚠️ Swap Refinement 오류: {e}")
            import traceback
            traceback.print_exc()
            return swapped_image

    def _create_face_hair_composite(
        self,
        source_face: Image.Image,
        hair_region: Image.Image,
        face_weight: float = 0.6,
        hair_weight: float = 0.4
    ) -> Image.Image:
        """
        얼굴과 머리카락 영역을 가중치 블렌딩하여 합성 이미지 생성

        BiSeNet으로 추출한 얼굴/머리카락 영역을 기반으로
        얼굴 특징과 머리카락 스타일을 모두 강조한 합성 이미지 생성

        Args:
            source_face: 원본 얼굴 이미지
            hair_region: BiSeNet으로 추출한 머리카락 영역 이미지
            face_weight: 얼굴 영역 가중치 (기본: 0.6)
            hair_weight: 머리카락 영역 가중치 (기본: 0.4)

        Returns:
            합성된 이미지 (PIL Image)
        """
        # numpy 배열로 변환
        face_array = np.array(source_face).astype(np.float32)
        hair_array = np.array(hair_region).astype(np.float32)

        # 머리카락 영역 마스크 생성 (회색(128)이 아닌 영역이 머리카락)
        hair_mask = np.any(np.abs(hair_array - 128) > 20, axis=2).astype(np.float32)

        # 가중치 정규화 (hair_weight만 사용)
        total = face_weight + hair_weight
        hair_w = hair_weight / total

        # 마스크 확장 (3채널)
        hair_mask_3d = hair_mask[:, :, np.newaxis]

        # 가중치 블렌딩:
        # - 머리카락 영역에서 머리카락 이미지의 색상/질감을 더 반영
        # - 얼굴 영역은 원본 유지
        blended = face_array.copy()
        blended = blended * (1 - hair_mask_3d * hair_w) + hair_array * (hair_mask_3d * hair_w)

        # 클리핑 및 변환
        blended = np.clip(blended, 0, 255).astype(np.uint8)

        return Image.fromarray(blended)

    def _blend_clip_embeddings(
        self,
        face_embeds: torch.Tensor,
        hair_embeds: torch.Tensor,
        face_weight: float = 0.6,
        hair_weight: float = 0.4
    ) -> torch.Tensor:
        """
        얼굴과 머리카락 CLIP 임베딩 블렌딩

        Args:
            face_embeds: 얼굴 CLIP 임베딩
            hair_embeds: 머리카락 CLIP 임베딩
            face_weight: 얼굴 가중치
            hair_weight: 머리카락 가중치

        Returns:
            블렌딩된 임베딩
        """
        # 가중치 정규화
        total = face_weight + hair_weight
        face_w = face_weight / total
        hair_w = hair_weight / total

        # 블렌딩
        blended = face_embeds * face_w + hair_embeds * hair_w

        return blended

    def _init_face_detection(self):
        """얼굴 감지 초기화"""
        if self.detection_method == 'mediapipe':
            try:
                import mediapipe as mp
                self.mp_face_detection = mp.solutions.face_detection
                self.face_detection = self.mp_face_detection.FaceDetection(
                    model_selection=1,
                    min_detection_confidence=0.5
                )
                print("✅ MediaPipe 얼굴 감지 준비 완료")
            except ImportError:
                print("⚠️ MediaPipe 없음. OpenCV로 전환...")
                self.detection_method = 'opencv'

        if self.detection_method == 'opencv':
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            print("✅ OpenCV 얼굴 감지 준비 완료")

    def detect_face(self, image_path):
        """
        얼굴 감지

        Returns:
            (x, y, w, h) 또는 None
        """
        image = cv2.imread(image_path)
        if image is None:
            return None

        if self.detection_method == 'mediapipe':
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.face_detection.process(rgb_image)

            if not results.detections:
                return None

            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box

            h, w = image.shape[:2]
            x = int(bbox.xmin * w)
            y = int(bbox.ymin * h)
            box_w = int(bbox.width * w)
            box_h = int(bbox.height * h)

            return (x, y, box_w, box_h)

        else:  # opencv
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )

            if len(faces) == 0:
                return None

            # 가장 큰 얼굴
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            return tuple(largest_face)

    def create_face_mask(self, image_path, expand_ratio=0.3, feather=15, include_hair=True, include_neck=False):
        """
        이미지에서 얼굴 자동 감지 후 마스크 생성

        Args:
            image_path: 이미지 경로
            expand_ratio: 얼굴 영역 확장
            feather: 경계 블러
            include_hair: 머리카락 포함 여부 (BiSeNet 사용 시)
            include_neck: 목 포함 여부 (BiSeNet 사용 시)

        Returns:
            마스크 (PIL Image) 또는 None
        """
        print(f"얼굴 감지 중: {os.path.basename(image_path)}")

        # BiSeNet으로 머리카락 포함 마스크 생성 시도
        if self.use_bisenet and self.face_parser is not None:
            try:
                image_pil = Image.open(image_path).convert("RGB")
                bisenet_mask = self.face_parser.get_face_hair_mask(
                    image_pil,
                    target_size=image_pil.size,
                    include_hair=include_hair,
                    include_neck=include_neck,
                    blur_radius=feather,
                    expand_ratio=1.0 + expand_ratio  # 1.3 for 0.3 expand
                )
                if bisenet_mask is not None:
                    parts = []
                    if include_hair:
                        parts.append("머리카락")
                    if include_neck:
                        parts.append("목")
                    parts_str = "+".join(parts) if parts else "얼굴만"
                    print(f"BiSeNet 마스크 생성 완료 ({parts_str})")
                    return bisenet_mask
                else:
                    print("BiSeNet 마스크 실패, 타원 마스크로 전환")
            except Exception as e:
                print(f"BiSeNet 오류: {e}, 타원 마스크로 전환")

        # Fallback: 타원형 마스크
        face_bbox = self.detect_face(image_path)

        if face_bbox is None:
            print("얼굴을 찾을 수 없습니다!")
            return None

        x, y, box_w, box_h = face_bbox
        print(f"얼굴 발견: x={x}, y={y}, w={box_w}, h={box_h}")

        # 원본 이미지 크기
        image = cv2.imread(image_path)
        h, w = image.shape[:2]

        # 마스크 생성
        mask = np.zeros((h, w), dtype=np.uint8)

        # 영역 확장 (머리카락 포함 시 더 크게)
        hair_expand_multiplier = 1.5 if include_hair else 1.0
        expand_w = int(box_w * expand_ratio * hair_expand_multiplier)
        expand_h = int(box_h * expand_ratio * hair_expand_multiplier)

        # 머리카락 포함 시 위쪽으로 더 확장
        expand_h_up = int(expand_h * 1.8) if include_hair else expand_h

        x1 = max(0, x - expand_w)
        y1 = max(0, y - expand_h_up)  # 위쪽 확장 (머리카락)
        x2 = min(w, x + box_w + expand_w)
        y2 = min(h, y + box_h + expand_h)

        # 타원형 마스크
        center_x = (x1 + x2) // 2
        center_y = (y1 + y2) // 2
        axes_x = (x2 - x1) // 2
        axes_y = (y2 - y1) // 2

        cv2.ellipse(mask, (center_x, center_y), (axes_x, axes_y),
                   0, 0, 360, 255, -1)

        # 경계 블러
        if feather > 0:
            mask = cv2.GaussianBlur(mask, (feather*2+1, feather*2+1), 0)

        return Image.fromarray(mask)

    def composite_face_auto(
        self,
        background_path,
        source_face_path,
        prompt="professional portrait, natural expression",
        output_path="output.png",
        face_strength=0.85,
        denoising_strength=0.92,
        num_inference_steps=50,
        guidance_scale=7.5,
        mask_expand=0.3,
        mask_blur=15,
        seed=None,
        save_mask=False,
        use_source_size=True,
        include_hair=True,
        include_neck=False,
        auto_detect_gender=True,
        face_blend_weight=0.8,
        hair_blend_weight=0.2,
        mask_padding=0,
        run_folder=None,
        stop_at=1.0,
        shortcut_scale=1.0,
        save_preview=False,
        use_pre_paste=None,
        pre_paste_denoising=0.65,
        use_face_swap=None,
        use_face_enhance=None,
        face_enhance_strength=0.8,
        use_swap_refinement=None,
        swap_refinement_strength=0.3
    ):
        """
        자동 얼굴 합성 (머리카락/목 포함)

        Args:
            background_path: 레퍼런스 배경 (얼굴이 있는 증명사진)
            source_face_path: 합성할 얼굴 이미지
            prompt: 프롬프트
            output_path: 출력 경로
            face_strength: 얼굴 반영 강도
            denoising_strength: 생성 강도
            num_inference_steps: 생성 스텝
            guidance_scale: 가이던스
            mask_expand: 마스크 확장 비율
            mask_blur: 마스크 블러
            seed: 랜덤 시드
            save_mask: 마스크 저장 여부
            use_source_size: 원본 얼굴 이미지 크기 사용 (True=원본 크기 유지)
            include_hair: 머리카락 포함 마스킹 (BiSeNet 사용)
            include_neck: 목 포함 마스킹 (BiSeNet 사용)
            auto_detect_gender: 머리카락으로 성별 힌트 자동 감지
            face_blend_weight: CLIP Blending 시 얼굴 가중치 (기본: 0.6)
            hair_blend_weight: CLIP Blending 시 머리카락 가중치 (기본: 0.4)
            mask_padding: 마스크 패딩 픽셀 (양수=확장, 음수=축소)
            stop_at: FaceID 적용 중단 시점 (0.0~1.0, 기본: 1.0=끝까지)
            use_pre_paste: Pre-paste 사용 여부 (None이면 클래스 설정 사용)
            pre_paste_denoising: Pre-paste 시 denoising strength (기본: 0.65)
            use_face_swap: Face Swap 사용 여부 (None이면 클래스 설정 사용)
            use_face_enhance: Face Enhance 사용 여부 (None이면 클래스 설정 사용)
            face_enhance_strength: Face Enhance 강도 (0.0~1.0, 기본: 0.8)
            use_swap_refinement: Face Swap Refinement 사용 여부 (None이면 클래스 설정 사용)
            swap_refinement_strength: Swap Refinement 강도 (0.1~0.5, 기본: 0.3)

        Returns:
            합성된 이미지 (PIL Image)
        """
        if not self.has_ip_adapter:
            print("IP-Adapter가 필요합니다!")
            return None

        # Pre-paste / Face Swap / Face Enhance / Swap Refinement 플래그 해결 (None이면 클래스 설정 사용)
        apply_pre_paste = use_pre_paste if use_pre_paste is not None else self.use_pre_paste
        apply_face_swap = use_face_swap if use_face_swap is not None else self.use_face_swap
        apply_face_enhance = use_face_enhance if use_face_enhance is not None else self.use_face_enhance
        apply_swap_refinement = use_swap_refinement if use_swap_refinement is not None else self.use_swap_refinement

        # Pre-paste 시 denoising strength 자동 조정
        actual_denoising = denoising_strength
        if apply_pre_paste:
            actual_denoising = pre_paste_denoising
            print(f"\n📋 Pre-paste 모드: denoising {denoising_strength} -> {actual_denoising}")

        # Preview 설정
        self.save_preview = save_preview
        if save_preview:
            # Preview 파일 경로 설정
            base_path = output_path.replace('.png', '')
            self.preview_path = f"{base_path}_preview.png"

        print("=" * 70)
        mode_str = "자동 얼굴 합성 (머리카락 포함)" if include_hair else "자동 얼굴 합성"
        if apply_pre_paste:
            mode_str += " + Pre-paste"
        if apply_face_swap:
            mode_str += " + Face Swap"
        if apply_swap_refinement:
            mode_str += " + Swap Refinement"
        if apply_face_enhance:
            mode_str += " + Face Enhance"
        print(mode_str)
        print("=" * 70)

        # 1. 원본 얼굴 이미지 로드 (크기 결정용)
        print("\n원본 얼굴 이미지 로딩...")
        source_face = Image.open(source_face_path).convert("RGB")
        src_w, src_h = source_face.size
        print(f"   원본 얼굴 크기: {src_w}x{src_h}")

        # 1.5. 성별 힌트 자동 감지 (머리카락 기반)
        gender_hint = ""
        if auto_detect_gender and self.use_bisenet and self.face_parser is not None:
            try:
                gender_hint = self.face_parser.detect_gender_from_hair(source_face)
                print(f"   머리카락 분석: {gender_hint}")

                # 프롬프트에 성별 힌트 추가
                if "female" in gender_hint.lower():
                    gender_hint = "woman, "
                elif "male" in gender_hint.lower():
                    gender_hint = "man, "
                else:
                    gender_hint = ""
            except Exception as e:
                print(f"   성별 감지 실패: {e}")
                gender_hint = ""

        # 2. 배경 이미지 로드 및 크기 조정
        print("\n📂 배경 이미지 로딩...")
        background_img = Image.open(background_path).convert("RGB")
        bg_w, bg_h = background_img.size

        # 배경 이미지 비율 기준 + SDXL 최적화 (1024/8배수)
        max_side = 1024
        aspect_ratio = bg_w / bg_h

        if bg_w > bg_h:
            target_w = max_side
            target_h = int(max_side / aspect_ratio)
        else:
            target_h = max_side
            target_w = int(max_side * aspect_ratio)

        # 8의 배수로 조정 (SDXL 필수 조건)
        target_w = (target_w // 8) * 8
        target_h = (target_h // 8) * 8
        target_size = (target_w, target_h)

        print(f"   ✨ 배경 비율 유지 스케일업: ({bg_w}, {bg_h}) -> {target_size}")

        # 배경 이미지를 비율 유지하며 리사이즈 (crop 없이)
        background_img = background_img.resize(target_size, Image.Resampling.LANCZOS)

        # 2.5. Pre-paste 적용 (소스 얼굴을 배경에 미리 붙여넣기)
        if apply_pre_paste:
            background_img = self._pre_paste_face(
                background_img,
                source_face,
                target_bbox=None,
                blend_mode="seamless",
                run_folder=run_folder if save_mask else None
            )
            # Pre-paste 최종 결과 저장 (디버깅용)
            if save_mask and run_folder:
                pre_paste_path = os.path.join(run_folder, "2.6_prepaste_final_result.png")
                background_img.save(pre_paste_path)
                print(f"   Pre-paste 최종 결과 저장: {os.path.basename(pre_paste_path)}")

        # 3. 배경에서 얼굴 자동 감지 + 마스크 생성
        print("\n배경에서 얼굴 마스크 자동 생성...")
        if include_hair:
            print("   (머리카락 영역 포함)")

        # 임시로 배경을 리사이즈된 크기로 저장 (마스크 생성용)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            background_img.save(tmp.name)
            temp_bg_path = tmp.name

        face_mask = self.create_face_mask(
            temp_bg_path,
            expand_ratio=mask_expand,
            feather=mask_blur,
            include_hair=include_hair,
            include_neck=include_neck
        )

        # 임시 파일 삭제
        os.unlink(temp_bg_path)

        if face_mask is None:
            print("배경에서 얼굴을 찾지 못했습니다!")
            print("TIP: 정면 얼굴이 명확한 이미지를 사용하세요")
            return None

        # 마스크 패딩 적용 (양수=확장, 음수=축소)
        if mask_padding != 0:
            mask_array = np.array(face_mask.convert('L'))
            kernel_size = abs(mask_padding)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size * 2 + 1, kernel_size * 2 + 1))

            if mask_padding > 0:
                # 확장 (dilate)
                mask_array = cv2.dilate(mask_array, kernel, iterations=1)
                print(f"   마스크 확장: +{mask_padding}px")
            else:
                # 축소 (erode)
                mask_array = cv2.erode(mask_array, kernel, iterations=1)
                print(f"   마스크 축소: {mask_padding}px")

            face_mask = Image.fromarray(mask_array)

        # 마스크 및 중간 결과 저장 (옵션)
        if save_mask:
            # run_folder가 있으면 해당 폴더에 저장, 없으면 기존 방식
            if run_folder:
                save_dir = run_folder
            else:
                save_dir = os.path.dirname(output_path) or '.'

            mask_array = np.array(face_mask.convert('L'))
            bg_array = np.array(background_img)
            mask_bool = mask_array > 127

            # 3. 마스크 오버레이 (배경에 마스크 영역 빨간색 표시) - 가장 중요!
            overlay_path = os.path.join(save_dir, "3_mask_overlay.png")
            overlay = bg_array.copy()
            overlay[mask_bool, 0] = np.clip(overlay[mask_bool, 0] * 0.5 + 127, 0, 255)  # Red
            overlay[mask_bool, 1] = (overlay[mask_bool, 1] * 0.5).astype(np.uint8)
            overlay[mask_bool, 2] = (overlay[mask_bool, 2] * 0.5).astype(np.uint8)
            Image.fromarray(overlay).save(overlay_path)
            print(f"   마스크 오버레이 저장: {os.path.basename(overlay_path)}")

            # 4. Inpainting 입력 시각화 (마스크 영역 검정색으로 표시)
            inpaint_input_path = os.path.join(save_dir, "4_inpaint_input.png")
            inpaint_vis = bg_array.copy()
            inpaint_vis[mask_bool] = 0  # 마스크 영역 검정색
            Image.fromarray(inpaint_vis).save(inpaint_input_path)
            print(f"   Inpainting 입력 저장: {os.path.basename(inpaint_input_path)}")

        # 4. 머리카락 영역 추출 (IP-Adapter 입력용)
        hair_region = None
        if include_hair and self.use_bisenet and self.face_parser is not None:
            try:
                hair_region = self.face_parser.extract_hair_region(source_face)
                if hair_region is not None:
                    print(f"   머리카락 영역 추출 완료 (IP-Adapter 입력용)")
            except Exception as e:
                print(f"   머리카락 추출 실패: {e}")

        # 5. 최종 크기 확인
        print(f"\n최종 출력 크기: {target_size}")
        # 6. 프롬프트 준비 (성별 힌트 포함)
        full_prompt = (
            f"professional ID photo, passport style photograph, "
            f"{gender_hint}"
            f"neutral background, studio lighting, front-facing portrait, "
            f"sharp focus, high quality, even lighting, formal photograph, "
            f"{prompt}"
        )

        print(f"\n프롬프트: {gender_hint}{prompt}")

        negative_prompt = (
            "bad quality, blurry, distorted, deformed, ugly, bad anatomy, "
            "wrong face, disfigured, mutation, low resolution, pixelated, "
            "artifacts, watermark, multiple faces, cropped face, "
            "side view, profile, looking away, tilted head"
        )

        # 6. Generator 설정
        generator = None
        if seed is not None:
            generator = torch.Generator(self.device).manual_seed(seed)
            print(f"시드: {seed}")

        print(f"\n⚙️ 설정:")
        print(f"   얼굴 반영 강도: {face_strength}")
        print(f"   생성 강도: {denoising_strength}")
        print(f"   생성 스텝: {num_inference_steps}")

        # 8. IP-Adapter 설정 및 이미지/임베딩 준비
        print(f"   IP-Adapter 모드: {self.ip_adapter_mode.upper()}")

        ip_adapter_kwargs = {}

        if self.no_ip_adapter:
            # Simple Inpainting 모드: IP-Adapter 없이 순수 인페인팅만
            print("   Simple Inpainting: IP-Adapter 사용 안함 (순수 인페인팅)")
            # ip_adapter_kwargs는 비워둠

        elif self.use_clip_blend:
            # CLIP Blending 모드: 픽셀 레벨 얼굴/머리카락 블렌딩 후 CLIP 인코딩
            print("   CLIP Blending: 픽셀 레벨 블렌딩...")
            self.pipeline.set_ip_adapter_scale(face_strength)

            if hair_region is not None:
                # 얼굴 + 머리카락 합성 이미지 생성
                composite_image = self._create_face_hair_composite(
                    source_face, hair_region,
                    face_weight=face_blend_weight,
                    hair_weight=hair_blend_weight
                )
                print(f"   [Face+Hair] 합성 이미지 생성 완료")
                print(f"   블렌딩 가중치: face={face_blend_weight:.0%}, hair={hair_blend_weight:.0%}")

                # 합성 이미지를 IP-Adapter 입력으로 사용
                ip_adapter_kwargs["ip_adapter_image"] = composite_image

            else:
                # 머리카락 영역이 없으면 원본 얼굴 사용
                print("   [Warning] 머리카락 영역 없음, 원본 얼굴 사용")
                ip_adapter_kwargs["ip_adapter_image"] = source_face

        elif self.use_dual_adapter and self.face_id_extractor is not None:
            # Dual IP-Adapter 모드: Standard (머리카락 CLIP) + FaceID (얼굴)
            # diffusers는 ip_adapter_image로 리스트 전달 시 각 어댑터에 분배
            print("   Dual IP-Adapter: 얼굴 + 머리카락 준비 중...")

            # 1. InsightFace 얼굴 임베딩 추출
            face_embedding = self.face_id_extractor.get_embedding_for_ip_adapter(
                source_face,
                dtype=self.dtype,
                device=self.device
            )

            # 2. 머리카락 이미지 준비 (CLIP용)
            hair_image_for_clip = hair_region if hair_region is not None else source_face
            if hair_region is not None:
                print("   [Hair] BiSeNet 머리카락 영역 사용")
            else:
                print("   [Hair] 전체 얼굴 이미지 사용")

            if face_embedding is not None:
                # FaceID 임베딩 포맷
                if face_embedding.dim() == 2:
                    face_embedding = face_embedding.unsqueeze(1)

                # CFG 포맷: (batch, seq, dim) -> (2*batch, seq, dim)
                negative_face = torch.zeros_like(face_embedding)
                face_embedding_cfg = torch.cat([negative_face, face_embedding], dim=0)

                # Dual adapter 입력: 두 어댑터에 이미지 리스트 전달
                # [Standard, FaceID] 순서
                # Standard는 CLIP으로 자동 인코딩, FaceID는 이미지에서 얼굴 감지
                ip_adapter_kwargs["ip_adapter_image"] = [hair_image_for_clip, source_face]

                print(f"   [Face] 얼굴 이미지 for FaceID")
                print(f"   [Hair] 머리카락 이미지 for CLIP: {hair_image_for_clip.size}")

                # 스케일 설정: [Standard(hair), FaceID(face)]
                hair_scale = face_strength * 0.4  # 머리카락 스타일
                face_scale = face_strength * 0.8  # 얼굴 정체성
                self.pipeline.set_ip_adapter_scale([hair_scale, face_scale])
                print(f"   스케일: hair={hair_scale:.2f}, face={face_scale:.2f}")

            else:
                print("   Dual: 얼굴 검출 실패, Standard 모드로 폴백")
                ip_adapter_kwargs["ip_adapter_image"] = source_face
                self.pipeline.set_ip_adapter_scale(face_strength)

        elif self.use_faceid_plus and self.face_id_extractor is not None:
            # FaceID Plus v2: InsightFace + CLIP 이미지 임베딩 (머리스타일 포함)
            self.pipeline.set_ip_adapter_scale(face_strength)
            print("   FaceID Plus v2: 얼굴+머리스타일 임베딩 추출 중...")

            # 1. InsightFace 얼굴 임베딩 추출
            face_embedding = self.face_id_extractor.get_embedding_for_ip_adapter(
                source_face,
                dtype=self.dtype,
                device=self.device
            )

            if face_embedding is not None:
                # 2. CLIP 이미지 임베딩 추출 (머리스타일 포함)
                from transformers import CLIPImageProcessor
                clip_processor = CLIPImageProcessor.from_pretrained("laion/CLIP-ViT-H-14-laion2B-s32B-b79K")
                clip_input = clip_processor(images=source_face, return_tensors="pt").pixel_values.to(self.device, dtype=self.dtype)

                # CLIP hidden states 추출 (last_hidden_state 사용)
                clip_output = self.clip_image_encoder(clip_input, output_hidden_states=True)
                # (1, 257, 1280) - 257 = 1 CLS + 256 patches
                clip_embeds = clip_output.hidden_states[-2]  # 마지막에서 두 번째 레이어

                # Shape 맞추기
                if face_embedding.dim() == 2:
                    face_embedding = face_embedding.unsqueeze(1)  # (1, 1, 512)

                # CFG용 negative 임베딩
                neg_face = torch.zeros_like(face_embedding)
                neg_clip = torch.zeros_like(clip_embeds)

                face_embedding_cfg = torch.cat([neg_face, face_embedding], dim=0)  # (2, 1, 512)
                clip_embeds_cfg = torch.cat([neg_clip, clip_embeds], dim=0)  # (2, 257, 1280)

                # Plus v2: CLIP 임베딩은 4D 필요: (batch, num_images, seq, hidden)
                clip_embeds_cfg = clip_embeds_cfg.unsqueeze(1)  # (2, 1, 257, 1280)

                # Plus v2: CLIP 임베딩을 projection layer에 직접 설정
                self.pipeline.unet.encoder_hid_proj.image_projection_layers[0].clip_embeds = clip_embeds_cfg
                self.pipeline.unet.encoder_hid_proj.image_projection_layers[0].shortcut_scale = shortcut_scale
                print(f"      shortcut_scale: {shortcut_scale:.2f} (머리스타일 반영 비율)")

                # 얼굴 임베딩만 전달
                ip_adapter_kwargs["ip_adapter_image_embeds"] = [face_embedding_cfg]
                print(f"   FaceID Plus v2: 임베딩 추출 완료")
                print(f"      얼굴 임베딩: {face_embedding_cfg.shape}")
                print(f"      CLIP 임베딩: {clip_embeds_cfg.shape} (머리스타일 포함)")

            else:
                print("   FaceID Plus v2: 얼굴 검출 실패, CLIP 임베딩으로 폴백")
                # image_encoder가 None이므로 ip_adapter_image 대신 CLIP 임베딩 직접 생성
                if self.clip_image_encoder is not None:
                    from transformers import CLIPImageProcessor
                    clip_processor = CLIPImageProcessor.from_pretrained("laion/CLIP-ViT-H-14-laion2B-s32B-b79K")
                    clip_input = clip_processor(images=source_face, return_tensors="pt").pixel_values.to(self.device, dtype=self.dtype)
                    clip_output = self.clip_image_encoder(clip_input, output_hidden_states=True)
                    clip_embeds = clip_output.hidden_states[-2]

                    # Zero face embedding (얼굴 검출 실패)
                    zero_face = torch.zeros(1, 1, 512, device=self.device, dtype=self.dtype)
                    neg_face = torch.zeros_like(zero_face)
                    neg_clip = torch.zeros_like(clip_embeds)

                    face_embedding_cfg = torch.cat([neg_face, zero_face], dim=0)
                    clip_embeds_cfg = torch.cat([neg_clip, clip_embeds], dim=0)
                    clip_embeds_cfg = clip_embeds_cfg.unsqueeze(1)

                    self.pipeline.unet.encoder_hid_proj.image_projection_layers[0].clip_embeds = clip_embeds_cfg
                    self.pipeline.unet.encoder_hid_proj.image_projection_layers[0].shortcut_scale = 1.0

                    ip_adapter_kwargs["ip_adapter_image_embeds"] = [face_embedding_cfg]
                else:
                    print("   [Warning] CLIP 인코더도 없음, IP-Adapter 없이 진행")

        elif self.use_faceid and self.face_id_extractor is not None:
            # FaceID (non-Plus): InsightFace 512-dim 임베딩 사용
            self.pipeline.set_ip_adapter_scale(face_strength)
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
                print(f"   FaceID: InsightFace 임베딩 추출 완료 (shape: {face_embedding_cfg.shape})")

            else:
                print("   FaceID: 얼굴 검출 실패, Standard 모드로 폴백")
                if self.pipeline.image_encoder is not None:
                    ip_adapter_kwargs["ip_adapter_image"] = source_face
                else:
                    print("   [Warning] image_encoder 없음, IP-Adapter 없이 진행")

        else:
            # Standard 모드: 이미지 직접 전달 (CLIP 인코딩)
            # 머리카락 영역이 있으면 블렌딩
            if hair_region is not None:
                face_array = np.array(source_face).astype(np.float32)
                hair_array = np.array(hair_region).astype(np.float32)

                # 머리카락 영역 마스크 (회색이 아닌 부분)
                hair_mask_arr = np.any(np.abs(hair_array - 128) > 10, axis=2).astype(np.float32)
                hair_mask_arr = hair_mask_arr[:, :, np.newaxis]

                # 원본 얼굴 + 머리카락 강조 블렌딩
                blended = face_array * (1 - hair_mask_arr * 0.3) + hair_array * (hair_mask_arr * 0.3)
                blended = np.clip(blended, 0, 255).astype(np.uint8)
                ip_adapter_input = Image.fromarray(blended)

                print("   Standard: 얼굴+머리카락 블렌딩 이미지 사용")

            else:
                ip_adapter_input = source_face
                print("   Standard: 원본 얼굴 이미지 사용")

            if self.pipeline.image_encoder is not None:
                ip_adapter_kwargs["ip_adapter_image"] = ip_adapter_input
            else:
                print("   [Warning] image_encoder 없음, IP-Adapter 없이 진행")

        print("\n합성 시작...")
        print("   배경 유지 + 새 얼굴 합성 중...")

        # 9. Inpainting 수행 (고해상도 생성 후 원본 크기로 축소)
        orig_width, orig_height = background_img.size

        # SDXL 최적 해상도로 스케일업 (최소 1024px, 비율 유지)
        min_size = 1024
        scale = max(min_size / orig_width, min_size / orig_height, 1.0)
        gen_width = int(orig_width * scale)
        gen_height = int(orig_height * scale)

        # 8의 배수로 조정
        gen_width = (gen_width // 8) * 8
        gen_height = (gen_height // 8) * 8

        # 생성용 이미지/마스크 리사이즈
        if scale > 1.0:
            bg_for_gen = background_img.resize((gen_width, gen_height), Image.Resampling.LANCZOS)
            mask_for_gen = face_mask.resize((gen_width, gen_height), Image.Resampling.LANCZOS)
            print(f"   고해상도 생성: {orig_width}x{orig_height} -> {gen_width}x{gen_height}")
        else:
            bg_for_gen = background_img
            mask_for_gen = face_mask

        print(f"🎨 생성 시작... (총 {num_inference_steps} 스텝, Stop-at: {stop_at*100:.0f}%)")

        # 타이밍 제어용 콜백 함수 정의
        def step_callback(pipe, step_index, _timestep, callback_kwargs):
            # 1. 현재 스텝 수 계산 (호환성 처리)
            try:
                cur_step = step_index.item() if hasattr(step_index, "item") else step_index
            except:
                cur_step = step_index

            # 2. 진행률 계산
            progress = cur_step / num_inference_steps

            # 3. Stop-At 로직 적용 & 로그 출력 (no_ip_adapter 모드면 건너뛰기)
            if self.no_ip_adapter:
                status_msg = "Simple Inpainting (IP-Adapter 없음)"
            elif progress > stop_at:
                # 지정된 구간을 넘었을 때 -> 얼굴 반영 끄기
                pipe.set_ip_adapter_scale(0.0)
                status_msg = f"🛑 OFF (Scale: 0.0)"
            else:
                # 구간 안일 때 -> 얼굴 반영 켜기
                pipe.set_ip_adapter_scale(face_strength)
                status_msg = f"✅ ON  (Scale: {face_strength})"

            # 매 스텝마다 로그 출력
            print(f"   [Step {cur_step:02d}/{num_inference_steps}] 진행률 {progress*100:.0f}% -> {status_msg}", flush=True)

            # 4. Preview 이미지 생성 (5 스텝마다)
            if hasattr(self, 'save_preview') and self.save_preview and cur_step > 0 and cur_step % 5 == 0:
                try:
                    latents = callback_kwargs.get("latents")
                    if latents is not None:
                        # VAE로 latents 디코딩
                        latents_scaled = 1 / 0.18215 * latents
                        with torch.no_grad():
                            image_tensor = pipe.vae.decode(latents_scaled).sample

                        # Tensor를 이미지로 변환
                        image_tensor = (image_tensor / 2 + 0.5).clamp(0, 1)
                        image_np = image_tensor.cpu().permute(0, 2, 3, 1).float().numpy()[0]
                        image_np = (image_np * 255).round().astype("uint8")
                        preview_img = Image.fromarray(image_np)

                        # Preview 저장
                        preview_path = self.preview_path.replace('.png', f'_step{cur_step:03d}.png')
                        preview_img.save(preview_path)

                        # stdout에 preview 경로 출력 (백엔드가 파싱함)
                        print(f"PREVIEW:{preview_path}", flush=True)

                        # 중간 텐서 정리 (메모리 누적 방지)
                        del latents_scaled, image_tensor
                        torch.cuda.empty_cache()
                except Exception as e:
                    print(f"   Preview 생성 실패 (Step {cur_step}): {e}")

            return callback_kwargs

        result = self.pipeline(
            prompt=full_prompt,
            negative_prompt=negative_prompt,
            image=bg_for_gen,
            mask_image=mask_for_gen,
            width=gen_width,
            height=gen_height,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            strength=actual_denoising,
            generator=generator,
            callback_on_step_end=step_callback,
            **ip_adapter_kwargs  # ip_adapter_image 또는 ip_adapter_image_embeds
        )

        output_image = result.images[0]

        # 원본 크기와 다르면 복원
        if output_image.size != (orig_width, orig_height):
            output_image = output_image.resize((orig_width, orig_height), Image.Resampling.LANCZOS)
            print(f"   출력 크기 복원: {gen_width}x{gen_height} -> {orig_width}x{orig_height}")

        # 10. Face Swap 적용 (선택적)
        if apply_face_swap:
            # Face Swap 전 결과 저장 (디버깅용) - swap 전에 저장!
            if save_mask and run_folder:
                pre_swap_path = os.path.join(run_folder, "5.5_result_before_swap.png")
                output_image.save(pre_swap_path)
                print(f"   Face Swap 전 결과 저장: {os.path.basename(pre_swap_path)}")

            output_image = self._apply_face_swap(output_image, source_face, run_folder if save_mask else None)

            # 10.2. Face Swap Refinement 적용 (선택적)
            if apply_swap_refinement:
                # Swap Refinement 전 저장 (디버깅용)
                if save_mask and run_folder:
                    pre_refine_path = os.path.join(run_folder, "5.6_result_before_refinement.png")
                    output_image.save(pre_refine_path)
                    print(f"   Swap Refinement 전 결과 저장: {os.path.basename(pre_refine_path)}")

                output_image = self._apply_swap_refinement(
                    output_image,
                    prompt=prompt,
                    denoising_strength=swap_refinement_strength,
                    guidance_scale=guidance_scale,
                    num_steps=max(15, num_inference_steps // 3),  # 메인 스텝의 1/3 정도 사용
                    seed=seed,
                    run_folder=run_folder if save_mask else None
                )

        # 10.5. Face Enhance 적용 (선택적 - GFPGAN)
        if apply_face_enhance:
            # Face Enhance 전 결과 저장 (디버깅용)
            if save_mask and run_folder:
                pre_enhance_path = os.path.join(run_folder, "5.7_result_before_enhance.png")
                output_image.save(pre_enhance_path)
                print(f"   Face Enhance 전 결과 저장: {os.path.basename(pre_enhance_path)}")

            output_image = self._apply_face_enhance(
                output_image,
                strength=face_enhance_strength,
                run_folder=run_folder if save_mask else None
            )

        # 11. 저장
        output_image.save(output_path)
        print(f"\n✅ 완료! 저장됨: {output_path}")
        print("=" * 70)

        # 12. GPU 메모리 정리 (메모리 누적 방지)
        cleanup_gpu_memory()
        print("🧹 GPU 메모리 정리 완료")

        return output_image


def main():
    parser = argparse.ArgumentParser(
        description='자동 얼굴 합성 (마스크 자동 생성)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
📖 사용 방법 (간단 버전!):

필요한 것:
  1. 배경 이미지 (좋은 배경/옷의 증명사진)
  2. 합성할 얼굴 (원본 얼굴 이미지)

  ⚠️ 마스크는 자동으로 생성됩니다!

🎯 사용 예시:

# 기본 (가장 간단)
python id_photo_face_composite_auto.py background.jpg face.jpg

# 프롬프트 추가
python id_photo_face_composite_auto.py background.jpg face.jpg \\
    --prompt "young asian woman, natural smile"

# 고품질 설정
python id_photo_face_composite_auto.py background.jpg face.jpg \\
    --prompt "professional headshot" \\
    --face-strength 0.9 \\
    --steps 75 \\
    --seed 42 \\
    --output result.png

# 마스크도 저장하고 싶을 때
python id_photo_face_composite_auto.py background.jpg face.jpg \\
    --save-mask \\
    --output result.png

# FaceID 모드 (정체성 보존 향상)
python id_photo_face_composite_auto.py background.jpg face.jpg \\
    --use-faceid \\
    --output result.png

💡 파라미터 가이드:

--face-strength (얼굴 반영 강도):
  0.75 ~ 0.85: 자연스럽게 (기본: 0.85)
  0.85 ~ 0.95: 원본과 매우 유사하게

--denoising (생성 강도):
  0.88 ~ 0.92: 배경 많이 유지 (기본: 0.92)
  0.92 ~ 0.96: 더 많이 변형

--mask-expand (마스크 확장):
  0.2 ~ 0.3: 얼굴만 (기본: 0.3)
  0.3 ~ 0.5: 얼굴 + 주변 조금

--mask-blur (마스크 블러):
  10 ~ 15: 자연스러운 경계 (기본: 15)
  15 ~ 25: 더 부드러운 경계

🔧 문제 해결:

얼굴을 못 찾을 때:
  - 정면 얼굴 이미지를 사용하세요
  - 얼굴이 크고 명확한 이미지 사용
  - --detection opencv 옵션 시도

배경이 너무 변할 때:
  --denoising 0.88 (낮추기)

얼굴이 잘 안나올 때:
  --face-strength 0.95 (높이기)
  --steps 100 (스텝 증가)

정체성이 안 맞을 때:
  --use-faceid (InsightFace 기반 FaceID 모드)
  ※ pip install insightface onnxruntime 필요

머리카락 스타일도 전이하고 싶을 때:
  --use-clip-blend (권장! CLIP 임베딩 블렌딩)
  ※ 얼굴 + 머리카락 CLIP 임베딩 가중치 블렌딩
  ※ BiSeNet으로 머리카락 영역 자동 추출
        """
    )

    parser.add_argument('background',
                       help='배경 이미지 (증명사진)')
    parser.add_argument('face',
                       help='합성할 얼굴 이미지')

    parser.add_argument('--prompt', '-p',
                       default='professional portrait, natural expression',
                       help='프롬프트')
    parser.add_argument('--auto-prompt', action='store_true',
                       help='Gemini Vision으로 프롬프트 자동 생성 (GEMINI_API_KEY 필요)')
    parser.add_argument('--output', '-o', default='output.png',
                       help='출력 파일')
    parser.add_argument('--face-strength', type=float, default=0.85,
                       help='얼굴 반영 강도 (기본: 0.85)')
    parser.add_argument('--denoising', type=float, default=0.92,
                       help='생성 강도 (기본: 0.92)')
    parser.add_argument('--steps', type=int, default=50,
                       help='생성 스텝 (기본: 50)')
    parser.add_argument('--guidance', type=float, default=7.5,
                       help='가이던스 (기본: 7.5)')
    parser.add_argument('--mask-expand', type=float, default=0.3,
                       help='마스크 확장 비율 (기본: 0.3)')
    parser.add_argument('--mask-blur', type=int, default=15,
                       help='마스크 블러 (기본: 15)')
    parser.add_argument('--mask-padding', type=int, default=0,
                       help='마스크 패딩 픽셀 (기본: 0, 양수=확장, 음수=축소)')
    parser.add_argument('--seed', type=int, help='랜덤 시드')
    parser.add_argument('--save-mask', action='store_true',
                       help='마스크 파일도 저장')
    parser.add_argument('--use-background-size', action='store_true',
                       help='배경 이미지 크기 사용 (기본: 원본 얼굴 크기)')
    parser.add_argument('--detection', choices=['mediapipe', 'opencv'],
                       default='opencv',
                       help='얼굴 감지 방법 (기본: opencv)')
    parser.add_argument('--no-hair', action='store_true',
                       help='머리카락 제외 (얼굴만 마스킹)')
    parser.add_argument('--include-neck', action='store_true',
                       help='목 포함 마스킹 (레퍼런스 목이 이상할 때 사용)')
    parser.add_argument('--no-bisenet', action='store_true',
                       help='BiSeNet 비활성화 (타원 마스크만 사용)')
    parser.add_argument('--no-gender-detect', action='store_true',
                       help='성별 자동 감지 비활성화')
    parser.add_argument('--no-ip-adapter', action='store_true',
                       help='IP-Adapter 없이 순수 인페인팅만 수행 (Pre-paste와 함께 사용 권장)')
    parser.add_argument('--use-faceid', action='store_true',
                       help='IP-Adapter FaceID 사용 (InsightFace 기반, 정체성 보존 향상)')
    parser.add_argument('--use-faceid-plus', action='store_true',
                       help='IP-Adapter FaceID Plus v2 사용 (얼굴 정체성 + 머리스타일 동시 반영)')
    parser.add_argument('--use-dual-adapter', action='store_true',
                       help='Dual IP-Adapter 사용 (FaceID + CLIP, 얼굴 정체성 + 머리카락 스타일 전이)')
    parser.add_argument('--use-clip-blend', action='store_true',
                       help='CLIP Blending 모드 (얼굴+머리카락 CLIP 임베딩 블렌딩, 권장)')
    parser.add_argument('--face-blend-weight', type=float, default=0.6,
                       help='CLIP Blending: 얼굴 가중치 (기본: 0.6)')
    parser.add_argument('--hair-blend-weight', type=float, default=0.4,
                       help='CLIP Blending: 머리카락 가중치 (기본: 0.4)')
    parser.add_argument('--stop-at', type=float, default=1.0,
                       help='FaceID 적용 중단 시점 (0.0~1.0, 기본: 1.0=끝까지)')
    parser.add_argument('--shortcut-scale', type=float, default=1.0,
                       help='FaceID Plus: CLIP 이미지(머리스타일) 반영 비율 (0.0~1.0, 기본: 1.0)')
    parser.add_argument('--save-preview', action='store_true',
                       help='중간 생성 과정 preview 이미지 저장 (5 스텝마다)')
    parser.add_argument('--use-pre-paste', action='store_true',
                       help='Pre-paste 모드: 소스 얼굴을 배경에 미리 붙여넣기 (얼굴 위치 정확도 향상)')
    parser.add_argument('--pre-paste-denoising', type=float, default=0.65,
                       help='Pre-paste 시 denoising strength (기본: 0.65)')
    parser.add_argument('--use-face-swap', action='store_true',
                       help='Face Swap 모드: 생성 후 얼굴 교체 (유사도 향상)')
    parser.add_argument('--face-swap-model', type=str, default='insightface',
                       choices=['insightface', 'ghost'],
                       help='Face Swap 모델 선택: insightface (빠름), ghost (고화질, 기본: insightface)')
    parser.add_argument('--use-face-enhance', action='store_true',
                       help='Face Enhance 모드: GFPGAN으로 얼굴 화질 개선')
    parser.add_argument('--face-enhance-strength', type=float, default=0.8,
                       help='Face Enhance 강도 (0.0~1.0, 기본: 0.8)')
    parser.add_argument('--use-swap-refinement', action='store_true',
                       help='Face Swap Refinement: Face Swap 후 얼굴 영역 경미한 인페인팅으로 자연스럽게 블렌딩')
    parser.add_argument('--swap-refinement-strength', type=float, default=0.3,
                       help='Swap Refinement 강도 (0.1~0.5, 기본: 0.3, 낮을수록 원본 유지)')
    parser.add_argument('--show', action='store_true',
                       help='결과 표시')

    args = parser.parse_args()

    # 입력 경로 처리 (inputs/ 폴더 자동 확인)
    background_path = get_input_path(args.background)
    face_path = get_input_path(args.face)

    # 파일 확인
    for path, name in [(background_path, '배경'), (face_path, '얼굴')]:
        if not os.path.exists(path):
            print(f"❌ {name} 파일을 찾을 수 없습니다: {path}")
            print(f"   (inputs/ 폴더도 확인했습니다)")
            return

    # 합성 수행
    compositor = AutoIDPhotoCompositor(
        detection_method=args.detection,
        use_bisenet=not args.no_bisenet,
        use_faceid=args.use_faceid,
        use_faceid_plus=args.use_faceid_plus,
        use_dual_adapter=args.use_dual_adapter,
        use_clip_blend=args.use_clip_blend,
        use_pre_paste=args.use_pre_paste,
        use_face_swap=args.use_face_swap,
        use_face_enhance=args.use_face_enhance,
        use_swap_refinement=args.use_swap_refinement,
        no_ip_adapter=args.no_ip_adapter,
        face_swap_model=args.face_swap_model
    )

    # no_ip_adapter 모드가 아닐 때만 IP-Adapter 체크
    if not args.no_ip_adapter and not compositor.has_ip_adapter:
        print("\nIP-Adapter 로딩 실패")
        print("   pip install diffusers transformers accelerate")
        return

    # 실행 폴더 생성 (outputs/run_name_timestamp/)
    run_folder = setup_run_folder(args.output)
    print(f"\n실행 폴더: {run_folder}")

    # 입력 이미지 복사
    bg_copy_path = os.path.join(run_folder, "1_reference.png")
    face_copy_path = os.path.join(run_folder, "2_face.png")
    shutil.copy2(background_path, bg_copy_path)
    shutil.copy2(face_path, face_copy_path)
    print(f"   입력 이미지 복사 완료")

    # 시드 처리 (미지정시 랜덤 생성)
    actual_seed = args.seed if args.seed is not None else random.randint(0, 2**32 - 1)

    # 프롬프트 처리 (auto-prompt 또는 수동)
    if args.auto_prompt and HAS_PROMPT_GENERATOR:
        print("\n🤖 Gemini Vision으로 프롬프트 생성 중...")
        generated_prompt = generate_prompt_from_face_image(face_path)
        final_prompt = generated_prompt
        print(f"   생성된 프롬프트: {final_prompt}")
        print(f"GENERATED_PROMPT:{final_prompt}", flush=True)
    elif args.auto_prompt and not HAS_PROMPT_GENERATOR:
        print("\n   prompt_generator.py를 찾을 수 없습니다. 기본 프롬프트를 사용합니다.")
        final_prompt = args.prompt
    else:
        final_prompt = args.prompt

    # 실행 명령어 기록
    command = ' '.join(sys.argv)

    # 출력 경로 (폴더 내 result.png)
    internal_output_path = os.path.join(run_folder, "5_result.png")

    result = compositor.composite_face_auto(
        background_path=background_path,
        source_face_path=face_path,
        prompt=final_prompt,
        output_path=internal_output_path,
        face_strength=args.face_strength,
        denoising_strength=args.denoising,
        num_inference_steps=args.steps,
        guidance_scale=args.guidance,
        mask_expand=args.mask_expand,
        mask_blur=args.mask_blur,
        seed=actual_seed,
        save_mask=True,  # 항상 마스크 저장
        use_source_size=not args.use_background_size,
        include_hair=not args.no_hair,
        include_neck=args.include_neck,
        auto_detect_gender=not args.no_gender_detect,
        face_blend_weight=args.face_blend_weight,
        hair_blend_weight=args.hair_blend_weight,
        mask_padding=args.mask_padding,
        run_folder=run_folder,
        stop_at=args.stop_at,
        shortcut_scale=args.shortcut_scale,
        save_preview=args.save_preview,
        use_pre_paste=args.use_pre_paste,
        pre_paste_denoising=args.pre_paste_denoising,
        use_face_swap=args.use_face_swap,
        use_face_enhance=args.use_face_enhance,
        face_enhance_strength=args.face_enhance_strength,
        use_swap_refinement=args.use_swap_refinement,
        swap_refinement_strength=args.swap_refinement_strength
    )

    # 파라미터 저장
    save_run_params(run_folder, args, command, actual_seed, background_path, face_path, final_prompt)

    if result and args.show:
        result.show()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        main()
    else:
        # 대화형 모드
        print("=" * 70)
        print("자동 얼굴 합성 (마스크 자동 생성)")
        print("=" * 70)
        print("\n💡 필요한 것: 배경 이미지 + 얼굴 이미지 (2개만!)\n")

        background = input("배경 이미지 경로: ").strip()
        face = input("합성할 얼굴 경로: ").strip()

        if not os.path.exists(background):
            print(f"❌ 배경 파일을 찾을 수 없습니다: {background}")
            sys.exit(1)
        if not os.path.exists(face):
            print(f"❌ 얼굴 파일을 찾을 수 없습니다: {face}")
            sys.exit(1)

        prompt = input("프롬프트 (Enter=기본값): ").strip()
        if not prompt:
            prompt = "professional portrait, natural expression"

        compositor = AutoIDPhotoCompositor()

        if compositor.has_ip_adapter:
            result = compositor.composite_face_auto(
                background_path=background,
                source_face_path=face,
                prompt=prompt,
                save_mask=True
            )
            if result:
                result.show()
