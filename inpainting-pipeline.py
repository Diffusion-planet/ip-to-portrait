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
        f.write(f"hair_blend_weight: {args.hair_blend_weight}\n\n")

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
    from face_id import FaceIDExtractor, FaceIDIPAdapter, check_insightface_available
    HAS_FACEID = check_insightface_available()
    if not HAS_FACEID:
        print("InsightFace not installed. FaceID mode unavailable.")
        print("Install: pip install insightface onnxruntime")
except ImportError:
    HAS_FACEID = False
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
    """자동 얼굴 감지 + 합성 (머리카락 포함, FaceID 지원, CLIP Blending)"""

    def __init__(self, detection_method='opencv', use_bisenet=True, use_faceid=False,
                 use_dual_adapter=False, use_clip_blend=False, use_faceid_plus=False):
        """
        파이프라인 초기화

        Args:
            detection_method: 'opencv' or 'mediapipe'
            use_bisenet: BiSeNet 사용 여부 (머리카락 마스킹)
            use_faceid: FaceID 모드 사용 여부 (정체성 보존 향상)
            use_dual_adapter: Dual IP-Adapter 모드 (FaceID + CLIP for hair transfer)
            use_clip_blend: CLIP Blending 모드 (얼굴+머리카락 CLIP 임베딩 블렌딩)
        """
        print("=" * 70)
        print("Inpainting Pipeline v5")
        print("=" * 70)

        # 디바이스 감지
        self.device = get_device()
        print(f"디바이스: {self.device}")

        # 모드 설정
        # Dual adapter requires both FaceID and CLIP
        self.use_dual_adapter = use_dual_adapter and HAS_FACEID
        self.use_faceid = (use_faceid or use_dual_adapter or use_faceid_plus) and HAS_FACEID
        self.use_faceid_plus = use_faceid_plus and HAS_FACEID  # FaceID Plus v2 (얼굴+머리스타일)
        self.use_clip_blend = use_clip_blend  # CLIP Blending mode

        if use_clip_blend:
            self.ip_adapter_mode = "clip_blend"  # CLIP embedding blending
        elif use_faceid_plus:
            self.ip_adapter_mode = "faceid_plus"  # FaceID Plus v2 (InsightFace + CLIP)
        elif use_dual_adapter:
            self.ip_adapter_mode = "dual"  # FaceID + CLIP
        elif self.use_faceid:
            self.ip_adapter_mode = "faceid"
        else:
            self.ip_adapter_mode = "standard"

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

        # dtype 설정 (CPU는 float32 사용)
        self.dtype = torch.float32 if self.device == "cpu" else torch.float16

        # Inpainting 파이프라인
        print("\nSDXL Inpainting 모델 로딩 중...")
        self.pipeline = AutoPipelineForInpainting.from_pretrained(
            "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
            torch_dtype=self.dtype,
            variant="fp16" if self.dtype == torch.float16 else None
        )

        # IP-Adapter 로드 (모드에 따라 다른 어댑터)
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
        if self.use_clip_blend:
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
        face_blend_weight=0.6,
        hair_blend_weight=0.4,
        mask_padding=0,
        run_folder=None,
        stop_at=1.0,
        save_preview=False
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

        Returns:
            합성된 이미지 (PIL Image)
        """
        if not self.has_ip_adapter:
            print("IP-Adapter가 필요합니다!")
            return None

        # Preview 설정
        self.save_preview = save_preview
        if save_preview:
            # Preview 파일 경로 설정
            base_path = output_path.replace('.png', '')
            self.preview_path = f"{base_path}_preview.png"

        print("=" * 70)
        print("자동 얼굴 합성 (머리카락 포함)" if include_hair else "자동 얼굴 합성")
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

        if self.use_clip_blend:
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
                self.pipeline.unet.encoder_hid_proj.image_projection_layers[0].shortcut_scale = 1.0

                # 얼굴 임베딩만 전달
                ip_adapter_kwargs["ip_adapter_image_embeds"] = [face_embedding_cfg]
                print(f"   FaceID Plus v2: 임베딩 추출 완료")
                print(f"      얼굴 임베딩: {face_embedding_cfg.shape}")
                print(f"      CLIP 임베딩: {clip_embeds_cfg.shape} (머리스타일 포함)")

            else:
                print("   FaceID Plus v2: 얼굴 검출 실패, 이미지 직접 사용")
                ip_adapter_kwargs["ip_adapter_image"] = source_face

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
                ip_adapter_kwargs["ip_adapter_image"] = source_face

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

            ip_adapter_kwargs["ip_adapter_image"] = ip_adapter_input

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

            # 3. Stop-At 로직 적용 & 로그 출력
            if progress > stop_at:
                # 지정된 구간을 넘었을 때 -> 얼굴 반영 끄기
                pipe.set_ip_adapter_scale(0.0)
                status_msg = f"🛑 OFF (Scale: 0.0)"
            else:
                # 구간 안일 때 -> 얼굴 반영 켜기
                pipe.set_ip_adapter_scale(face_strength)
                status_msg = f"✅ ON  (Scale: {face_strength})"

            # 매 스텝마다 로그 출력
            print(f"   [Step {cur_step:02d}/{num_inference_steps}] 진행률 {progress*100:.0f}% -> FaceID: {status_msg}", flush=True)

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
            strength=denoising_strength,
            generator=generator,
            callback_on_step_end=step_callback,
            **ip_adapter_kwargs  # ip_adapter_image 또는 ip_adapter_image_embeds
        )

        output_image = result.images[0]

        # 원본 크기와 다르면 복원
        if output_image.size != (orig_width, orig_height):
            output_image = output_image.resize((orig_width, orig_height), Image.Resampling.LANCZOS)
            print(f"   출력 크기 복원: {gen_width}x{gen_height} -> {orig_width}x{orig_height}")

        # 10. 저장
        output_image.save(output_path)
        print(f"\n✅ 완료! 저장됨: {output_path}")
        print("=" * 70)

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
    parser.add_argument('--save-preview', action='store_true',
                       help='중간 생성 과정 preview 이미지 저장 (5 스텝마다)')
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
        use_clip_blend=args.use_clip_blend
    )

    if not compositor.has_ip_adapter:
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
        save_preview=args.save_preview
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
