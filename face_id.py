"""
FaceID Module for Inpainting Pipeline
InsightFace-based face embedding extraction for IP-Adapter FaceID Plus v2

Supports multiple face swap models:
- InsightFace (inswapper_128): Fast, good quality
- Ghost (GHFV): High quality, slower

Usage:
    face_id = FaceIDExtractor(device="mps")
    embedding = face_id.get_embedding(face_image)

    # With pipeline
    pipe.load_ip_adapter(..., weight_name="ip-adapter-faceid-plusv2_sdxl.bin")
    result = pipe(..., ip_adapter_image_embeds=embedding)

    # Face swap with model selection
    swapper = get_face_swapper(model="ghost", device="cuda")
    result = swapper.swap_face(target_image, source_image)
"""

import os
import sys
import torch
import numpy as np
from PIL import Image
from typing import Optional, Tuple, Union, Literal

# Face swap model type
FaceSwapModel = Literal["insightface", "ghost"]

# InsightFace is optional
try:
    print("[DEBUG face_id.py] Attempting to import insightface...")
    from insightface.app import FaceAnalysis
    HAS_INSIGHTFACE = True
    print("[DEBUG face_id.py] ✅ InsightFace imported successfully!")
except ImportError as e:
    HAS_INSIGHTFACE = False
    print(f"[DEBUG face_id.py] ❌ InsightFace import failed: {e}")
    print("insightface not installed. FaceID mode unavailable.")
    print("Install: pip install insightface onnxruntime")


class FaceSwapper:
    """
    InsightFace-based face swapper using inswapper_128.onnx model.

    Swaps faces between source and target images for better likeness preservation.
    """

    def __init__(self, device: str = "cpu"):
        """
        Initialize face swapper.

        Args:
            device: "cuda", "mps", or "cpu"
        """
        self.device = device
        self.swapper = None
        self.face_analyzer = None
        self._initialized = False

    def _get_providers(self) -> list:
        """Get ONNX Runtime providers based on device."""
        if self.device == "cuda":
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]
        elif self.device == "mps":
            return ["CoreMLExecutionProvider", "CPUExecutionProvider"]
        else:
            return ["CPUExecutionProvider"]

    def load(self, model_path: str = None) -> bool:
        """
        Load face swapper model.

        Args:
            model_path: Path to inswapper_128.onnx (auto-download if None)

        Returns:
            True if loaded successfully
        """
        if not HAS_INSIGHTFACE:
            print("InsightFace not available for face swap")
            return False

        if self._initialized:
            return True

        try:
            import insightface
            from insightface.app import FaceAnalysis

            providers = self._get_providers()

            # Initialize face analyzer
            print(f"Loading FaceSwapper on {self.device}...")
            self.face_analyzer = FaceAnalysis(
                name="buffalo_l",
                providers=providers
            )
            self.face_analyzer.prepare(ctx_id=0, det_size=(640, 640))

            # Load inswapper model (prefer 512 for higher quality)
            if model_path is None:
                # Try inswapper_512 first (higher quality), fallback to 128
                try:
                    model_path = insightface.model_zoo.get_model(
                        "inswapper_512.onnx",
                        download=True,
                        providers=providers
                    )
                    self.swapper = model_path
                    self._model_name = "inswapper_512"
                except Exception:
                    print("inswapper_512 not available, using inswapper_128")
                    model_path = insightface.model_zoo.get_model(
                        "inswapper_128.onnx",
                        download=True,
                        providers=providers
                    )
                    self.swapper = model_path
                    self._model_name = "inswapper_128"
            else:
                import onnxruntime as ort
                self.swapper = insightface.model_zoo.get_model(
                    model_path,
                    providers=providers
                )
                self._model_name = os.path.basename(model_path)

            self._initialized = True
            print(f"FaceSwapper loaded successfully ({self._model_name})")
            return True

        except Exception as e:
            print(f"Failed to load FaceSwapper: {e}")
            import traceback
            traceback.print_exc()
            return False

    def swap_face(
        self,
        target_image: Union[str, Image.Image, np.ndarray],
        source_image: Union[str, Image.Image, np.ndarray],
    ) -> Optional[Image.Image]:
        """
        Swap face from source to target image.

        Args:
            target_image: Image where face will be replaced
            source_image: Image containing the source face

        Returns:
            Result image with swapped face, or None if failed
        """
        if not self.load():
            return None

        # Convert to numpy arrays
        if isinstance(target_image, str):
            target_image = Image.open(target_image).convert("RGB")
        if isinstance(source_image, str):
            source_image = Image.open(source_image).convert("RGB")

        if isinstance(target_image, Image.Image):
            target_np = np.array(target_image)
        else:
            target_np = target_image

        if isinstance(source_image, Image.Image):
            source_np = np.array(source_image)
        else:
            source_np = source_image

        # Convert RGB to BGR for InsightFace
        target_bgr = target_np[:, :, ::-1].copy()
        source_bgr = source_np[:, :, ::-1].copy()

        # Detect faces
        target_faces = self.face_analyzer.get(target_bgr)
        source_faces = self.face_analyzer.get(source_bgr)

        if len(target_faces) == 0:
            print("No face detected in target image")
            return None
        if len(source_faces) == 0:
            print("No face detected in source image")
            return None

        # Get largest faces
        target_face = max(target_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        source_face = max(source_faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

        # Swap face
        result_bgr = self.swapper.get(target_bgr, target_face, source_face, paste_back=True)

        # Convert BGR back to RGB
        result_rgb = result_bgr[:, :, ::-1]

        return Image.fromarray(result_rgb)


# Ghost Face Swap imports (optional)
# Note: We use InsightFace for face alignment instead of mxnet-based CoordHandler
HAS_GHOST = False
GHOST_DIR = os.path.join(os.path.dirname(__file__), "ghost")
try:
    if os.path.exists(GHOST_DIR):
        sys.path.insert(0, GHOST_DIR)
        from network.AEI_Net import AEI_Net
        import kornia
        HAS_GHOST = True
        print("[DEBUG face_id.py] ✅ Ghost imported successfully!")
except ImportError as e:
    print(f"[DEBUG face_id.py] Ghost not available: {e}")
    print("Run: bash scripts/setup_ghost.sh to install Ghost")


# InsightFace-based face alignment (replaces mxnet-based CoordHandler)
class InsightFaceAligner:
    """
    Face alignment using InsightFace landmarks.
    This replaces Ghost's mxnet-based coordinate_reg module.
    """

    # Standard face template for 112x112 aligned face
    FACE_TEMPLATE = np.array([
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041]
    ], dtype=np.float32)

    def __init__(self):
        self.face_analyzer = None
        if HAS_INSIGHTFACE:
            self.face_analyzer = FaceAnalysis(
                name="buffalo_l",
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
            )
            self.face_analyzer.prepare(ctx_id=0, det_size=(640, 640))

    def process(self, image_np: np.ndarray, output_size: int = 256) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """
        Detect face and return aligned face image with transformation matrix.

        Args:
            image_np: RGB image as numpy array
            output_size: Output size for aligned face

        Returns:
            (aligned_face, transform_matrix) or (None, None) if failed
        """
        if self.face_analyzer is None:
            return None, None

        try:
            from skimage import transform as trans

            # Detect face (InsightFace expects BGR)
            faces = self.face_analyzer.get(image_np[:, :, ::-1].copy())
            if len(faces) == 0:
                return None, None

            # Get largest face
            face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

            # Get 5-point landmarks (eyes, nose, mouth corners)
            landmarks = face.kps  # shape: (5, 2)

            # Scale template to output size
            scale = output_size / 112.0
            scaled_template = self.FACE_TEMPLATE * scale

            # Compute similarity transform
            tform = trans.SimilarityTransform()
            tform.estimate(landmarks, scaled_template)

            # Get transformation matrix (2x3)
            M = tform.params[0:2]

            # Warp image
            import cv2
            aligned = cv2.warpAffine(
                image_np,
                M,
                (output_size, output_size),
                borderValue=(0, 0, 0)
            )

            return aligned, M

        except Exception as e:
            print(f"Face alignment failed: {e}")
            return None, None


class GhostFaceSwapper:
    """
    Ghost (GHFV) based high-quality face swapper.

    Uses AEI-Net architecture with ArcFace embeddings for superior face swap quality.
    Reference: https://github.com/ai-forever/ghost
    """

    def __init__(self, device: str = "cuda"):
        """
        Initialize Ghost face swapper.

        Args:
            device: "cuda" or "cpu" (MPS not fully supported)
        """
        self.device = device if device != "mps" else "cpu"
        self.generator = None
        self.arcface = None
        self.coord_handler = None
        self._initialized = False

    def load(self, model_dir: str = None) -> bool:
        """
        Load Ghost models.

        Args:
            model_dir: Path to Ghost models directory

        Returns:
            True if loaded successfully
        """
        if not HAS_GHOST:
            print("Ghost not available. Run: bash setup_ghost.sh")
            return False

        if self._initialized:
            return True

        try:
            if model_dir is None:
                # Try ghost/weights first (setup_ghost.sh location), fallback to models/ghost
                base_dir = os.path.dirname(__file__)
                ghost_weights = os.path.join(base_dir, "ghost", "weights")
                models_ghost = os.path.join(base_dir, "models", "ghost")

                if os.path.exists(os.path.join(ghost_weights, "G_unet_2blocks.pth")):
                    model_dir = ghost_weights
                elif os.path.exists(os.path.join(models_ghost, "G_unet_2blocks.pth")):
                    model_dir = models_ghost
                else:
                    model_dir = ghost_weights  # Default for error message

            # Load Generator (AEI-Net)
            generator_path = os.path.join(model_dir, "G_unet_2blocks.pth")
            if not os.path.exists(generator_path):
                print(f"Generator model not found: {generator_path}")
                print("Run: bash scripts/setup_ghost.sh to download models")
                return False

            print(f"Loading Ghost Generator on {self.device}...")
            # AEI_Net params: backbone="unet", num_blocks=2, c_id=512
            # Model filename G_unet_2blocks.pth indicates backbone=unet, num_blocks=2
            self.generator = AEI_Net(backbone="unet", num_blocks=2, c_id=512).to(self.device)
            self.generator.load_state_dict(torch.load(generator_path, map_location=self.device))
            self.generator.eval()

            # Load ArcFace for face embeddings
            arcface_path = os.path.join(model_dir, "arcface.pth")
            if os.path.exists(arcface_path):
                from network.arcface import iresnet100
                self.arcface = iresnet100().to(self.device)
                self.arcface.load_state_dict(torch.load(arcface_path, map_location=self.device))
                self.arcface.eval()
            else:
                # Use InsightFace as fallback for embeddings
                print("ArcFace not found, using InsightFace for embeddings")
                if HAS_INSIGHTFACE:
                    self.arcface = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                    self.arcface.prepare(ctx_id=0)

            # Initialize face aligner (InsightFace-based, no mxnet needed)
            self.coord_handler = InsightFaceAligner()

            self._initialized = True
            print("Ghost loaded successfully")
            return True

        except Exception as e:
            print(f"Failed to load Ghost: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _get_face_embedding(self, image_np: np.ndarray) -> Optional[torch.Tensor]:
        """Extract face embedding using ArcFace."""
        if self.arcface is None:
            return None

        # If using InsightFace fallback
        if hasattr(self.arcface, 'get'):
            faces = self.arcface.get(image_np[:, :, ::-1])  # RGB to BGR
            if len(faces) == 0:
                return None
            face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
            return torch.from_numpy(face.normed_embedding).unsqueeze(0).to(self.device)

        # Native ArcFace
        try:
            from PIL import Image
            import torchvision.transforms as transforms

            # Preprocess for ArcFace
            transform = transforms.Compose([
                transforms.Resize((112, 112)),
                transforms.ToTensor(),
                transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
            ])

            img = Image.fromarray(image_np)
            img_tensor = transform(img).unsqueeze(0).to(self.device)

            with torch.no_grad():
                embedding = self.arcface(img_tensor)

            return embedding

        except Exception as e:
            print(f"Face embedding extraction failed: {e}")
            return None

    def _align_face(self, image_np: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """Align face and get transformation matrix."""
        try:
            aligned, matrix = self.coord_handler.process(image_np)
            return aligned, matrix
        except Exception as e:
            print(f"Face alignment failed: {e}")
            return None, None

    def swap_face(
        self,
        target_image: Union[str, Image.Image, np.ndarray],
        source_image: Union[str, Image.Image, np.ndarray],
    ) -> Optional[Image.Image]:
        """
        Swap face from source to target image using Ghost.

        Args:
            target_image: Image where face will be replaced
            source_image: Image containing the source face

        Returns:
            Result image with swapped face, or None if failed
        """
        if not self.load():
            return None

        # Convert to numpy arrays
        if isinstance(target_image, str):
            target_image = Image.open(target_image).convert("RGB")
        if isinstance(source_image, str):
            source_image = Image.open(source_image).convert("RGB")

        if isinstance(target_image, Image.Image):
            target_np = np.array(target_image)
        else:
            target_np = target_image.copy()

        if isinstance(source_image, Image.Image):
            source_np = np.array(source_image)
        else:
            source_np = source_image.copy()

        try:
            # Align faces
            target_aligned, target_matrix = self._align_face(target_np)
            source_aligned, _ = self._align_face(source_np)

            if target_aligned is None or source_aligned is None:
                print("Face alignment failed, falling back to InsightFace")
                return self._fallback_swap(target_np, source_np)

            # Get source face embedding
            source_embedding = self._get_face_embedding(source_aligned)
            if source_embedding is None:
                print("Face embedding failed, falling back to InsightFace")
                return self._fallback_swap(target_np, source_np)

            # Convert aligned images to tensors
            target_tensor = torch.from_numpy(target_aligned).permute(2, 0, 1).unsqueeze(0).float().to(self.device) / 255.0
            target_tensor = target_tensor * 2 - 1  # Normalize to [-1, 1]

            # Generate swapped face
            with torch.no_grad():
                swapped_tensor, _ = self.generator(target_tensor, source_embedding)

            # Convert back to numpy
            swapped = ((swapped_tensor[0].permute(1, 2, 0).cpu().numpy() + 1) / 2 * 255).astype(np.uint8)

            # Paste back to original image
            result = self._paste_back(target_np, swapped, target_matrix)

            return Image.fromarray(result)

        except Exception as e:
            print(f"Ghost swap failed: {e}")
            import traceback
            traceback.print_exc()
            return self._fallback_swap(target_np, source_np)

    def _fallback_swap(self, target_np: np.ndarray, source_np: np.ndarray) -> Optional[Image.Image]:
        """Fallback to InsightFace if Ghost fails."""
        if HAS_INSIGHTFACE:
            print("Using InsightFace fallback...")
            fallback = FaceSwapper(device=self.device)
            return fallback.swap_face(target_np, source_np)
        return None

    def _paste_back(self, original: np.ndarray, swapped: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        """Paste swapped face back to original image."""
        import cv2

        # Inverse transform
        h, w = original.shape[:2]
        inv_matrix = cv2.invertAffineTransform(matrix)

        # Warp swapped face back
        warped = cv2.warpAffine(swapped, inv_matrix, (w, h))

        # Create mask
        mask = np.ones(swapped.shape[:2], dtype=np.float32)
        mask_warped = cv2.warpAffine(mask, inv_matrix, (w, h))

        # Blend with feathering
        mask_warped = cv2.GaussianBlur(mask_warped, (21, 21), 0)
        mask_3ch = np.stack([mask_warped] * 3, axis=-1)

        result = original * (1 - mask_3ch) + warped * mask_3ch
        return result.astype(np.uint8)


def get_face_swapper(model: FaceSwapModel = "insightface", device: str = "cuda"):
    """
    Factory function to get face swapper by model name.

    Args:
        model: "insightface" or "ghost"
        device: "cuda", "mps", or "cpu"

    Returns:
        Face swapper instance
    """
    if model == "ghost":
        if HAS_GHOST:
            return GhostFaceSwapper(device=device)
        else:
            print("Ghost not available, falling back to InsightFace")
            return FaceSwapper(device=device)
    else:
        return FaceSwapper(device=device)


class FaceIDExtractor:
    """
    InsightFace-based face embedding extractor for IP-Adapter FaceID.

    Extracts 512-dimensional face embeddings that capture identity features
    much better than CLIP-based approaches.
    """

    def __init__(self, device: str = "cpu", model_name: str = "buffalo_l"):
        """
        Initialize FaceID extractor.

        Args:
            device: "cuda", "mps", or "cpu"
            model_name: InsightFace model name (buffalo_l recommended)
        """
        self.device = device
        self.model_name = model_name
        self.app = None
        self._initialized = False

    def _get_providers(self) -> Tuple[list, list]:
        """Get ONNX Runtime providers based on device."""
        if self.device == "cuda":
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            provider_options = [
                {"device_id": 0},
                {}
            ]
        elif self.device == "mps":
            # MPS uses CoreML on Apple Silicon
            providers = ["CoreMLExecutionProvider", "CPUExecutionProvider"]
            provider_options = [{}, {}]
        else:
            providers = ["CPUExecutionProvider"]
            provider_options = [{}]

        return providers, provider_options

    def load(self) -> bool:
        """
        Load InsightFace model.

        Returns:
            True if loaded successfully, False otherwise
        """
        if not HAS_INSIGHTFACE:
            print("InsightFace not available")
            return False

        if self._initialized:
            return True

        try:
            providers, provider_options = self._get_providers()

            print(f"Loading InsightFace ({self.model_name}) on {self.device}...")
            print(f"  Providers: {providers}")

            self.app = FaceAnalysis(
                name=self.model_name,
                providers=providers,
                provider_options=provider_options
            )
            self.app.prepare(ctx_id=0, det_size=(640, 640))

            self._initialized = True
            print(f"InsightFace loaded successfully")
            return True

        except Exception as e:
            print(f"Failed to load InsightFace: {e}")
            import traceback
            traceback.print_exc()
            return False

    def detect_face(self, image: Union[str, Image.Image, np.ndarray]) -> Optional[dict]:
        """
        Detect face in image.

        Args:
            image: PIL Image, numpy array, or path

        Returns:
            Face dict with bbox, embedding, landmarks, etc. or None
        """
        if not self.load():
            return None

        # Convert to numpy array
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")
        if isinstance(image, Image.Image):
            image = np.array(image)

        # InsightFace expects BGR
        if len(image.shape) == 3 and image.shape[2] == 3:
            image_bgr = image[:, :, ::-1]
        else:
            image_bgr = image

        faces = self.app.get(image_bgr)

        if len(faces) == 0:
            print("No face detected")
            return None

        # Return largest face
        largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        return largest_face

    def get_embedding(
        self,
        image: Union[str, Image.Image, np.ndarray],
        return_tensor: bool = True
    ) -> Optional[Union[np.ndarray, torch.Tensor]]:
        """
        Extract face embedding from image.

        Args:
            image: PIL Image, numpy array, or path
            return_tensor: Return as torch.Tensor if True, numpy array if False

        Returns:
            512-dimensional face embedding or None if no face detected
        """
        face = self.detect_face(image)

        if face is None:
            return None

        embedding = face.normed_embedding  # 512-dim normalized embedding

        if return_tensor:
            embedding = torch.from_numpy(embedding).unsqueeze(0)

        return embedding

    def get_embedding_for_ip_adapter(
        self,
        image: Union[str, Image.Image, np.ndarray],
        dtype: torch.dtype = torch.float16,
        device: str = None
    ) -> Optional[torch.Tensor]:
        """
        Get face embedding formatted for IP-Adapter FaceID.

        Args:
            image: PIL Image, numpy array, or path
            dtype: Tensor dtype (float16 for GPU, float32 for CPU)
            device: Target device (uses self.device if None)

        Returns:
            Tensor of shape (1, 512) ready for IP-Adapter FaceID
        """
        embedding = self.get_embedding(image, return_tensor=True)

        if embedding is None:
            return None

        target_device = device or self.device

        # Format for IP-Adapter: (batch, embedding_dim)
        embedding = embedding.to(dtype=dtype, device=target_device)

        return embedding

    def get_face_bbox(
        self,
        image: Union[str, Image.Image, np.ndarray]
    ) -> Optional[Tuple[int, int, int, int]]:
        """
        Get face bounding box.

        Returns:
            (x1, y1, x2, y2) or None
        """
        face = self.detect_face(image)

        if face is None:
            return None

        bbox = face.bbox.astype(int)
        return tuple(bbox)


class FaceIDIPAdapter:
    """
    Helper class to manage IP-Adapter FaceID loading and usage.

    Wraps the diffusers pipeline to provide easy FaceID integration.
    """

    # Model paths
    FACEID_REPO = "h94/IP-Adapter-FaceID"
    FACEID_WEIGHT = "ip-adapter-faceid-plusv2_sdxl.bin"

    STANDARD_REPO = "h94/IP-Adapter"
    STANDARD_SUBFOLDER = "sdxl_models"
    STANDARD_WEIGHT = "ip-adapter_sdxl.bin"

    def __init__(self, pipeline, device: str = "cpu"):
        """
        Initialize FaceID IP-Adapter manager.

        Args:
            pipeline: Diffusers pipeline (AutoPipelineForInpainting, etc.)
            device: Device string
        """
        self.pipeline = pipeline
        self.device = device
        self.face_extractor = None
        self.mode = None  # "faceid" or "standard"

    def load_faceid_mode(self, scale: float = 0.85) -> bool:
        """
        Load IP-Adapter FaceID Plus v2 mode.

        This mode uses InsightFace embeddings for better identity preservation.

        Args:
            scale: IP-Adapter scale (0.0-1.0)

        Returns:
            True if loaded successfully
        """
        try:
            # Initialize face extractor
            if self.face_extractor is None:
                self.face_extractor = FaceIDExtractor(device=self.device)

            if not self.face_extractor.load():
                print("FaceID mode requires InsightFace")
                return False

            print(f"Loading IP-Adapter FaceID Plus v2...")
            self.pipeline.load_ip_adapter(
                self.FACEID_REPO,
                subfolder=None,
                weight_name=self.FACEID_WEIGHT,
                image_encoder_folder=None,
            )
            self.pipeline.set_ip_adapter_scale(scale)

            self.mode = "faceid"
            print(f"IP-Adapter FaceID loaded (scale={scale})")
            return True

        except Exception as e:
            print(f"Failed to load FaceID mode: {e}")
            import traceback
            traceback.print_exc()
            return False

    def load_standard_mode(self, scale: float = 0.85) -> bool:
        """
        Load Standard IP-Adapter mode.

        This mode uses CLIP embeddings (less identity preservation).

        Args:
            scale: IP-Adapter scale (0.0-1.0)

        Returns:
            True if loaded successfully
        """
        try:
            print(f"Loading Standard IP-Adapter...")
            self.pipeline.load_ip_adapter(
                self.STANDARD_REPO,
                subfolder=self.STANDARD_SUBFOLDER,
                weight_name=self.STANDARD_WEIGHT,
            )
            self.pipeline.set_ip_adapter_scale(scale)

            self.mode = "standard"
            print(f"Standard IP-Adapter loaded (scale={scale})")
            return True

        except Exception as e:
            print(f"Failed to load standard mode: {e}")
            import traceback
            traceback.print_exc()
            return False

    def prepare_ip_adapter_input(
        self,
        face_image: Union[str, Image.Image],
        dtype: torch.dtype = torch.float16
    ) -> dict:
        """
        Prepare IP-Adapter input based on current mode.

        Args:
            face_image: Source face image
            dtype: Tensor dtype

        Returns:
            Dict with either 'ip_adapter_image' or 'ip_adapter_image_embeds'
        """
        if isinstance(face_image, str):
            face_image = Image.open(face_image).convert("RGB")

        if self.mode == "faceid":
            # FaceID mode: use InsightFace embedding
            embedding = self.face_extractor.get_embedding_for_ip_adapter(
                face_image,
                dtype=dtype,
                device=self.device
            )

            if embedding is None:
                print("Warning: No face detected, falling back to image input")
                return {"ip_adapter_image": face_image}

            return {"ip_adapter_image_embeds": embedding}

        else:
            # Standard mode: use image directly (CLIP encodes internally)
            return {"ip_adapter_image": face_image}

    def set_scale(self, scale: float):
        """Set IP-Adapter scale."""
        self.pipeline.set_ip_adapter_scale(scale)


def check_insightface_available() -> bool:
    """Check if InsightFace is available."""
    return HAS_INSIGHTFACE


# GFPGAN is optional - requires compatibility shim for torchvision >= 0.24
# torchvision 0.24+ removed functional_tensor module, but GFPGAN still uses it
try:
    # Add compatibility shim for torchvision >= 0.24
    import torchvision
    tv_version = tuple(map(int, torchvision.__version__.split('+')[0].split('.')[:2]))
    if tv_version >= (0, 24):
        import sys
        import types
        from torchvision.transforms import functional as F

        # Create a fake functional_tensor module that redirects to functional
        functional_tensor = types.ModuleType('torchvision.transforms.functional_tensor')
        functional_tensor.__dict__.update({
            name: getattr(F, name) for name in dir(F) if not name.startswith('_')
        })
        sys.modules['torchvision.transforms.functional_tensor'] = functional_tensor
        print(f"[DEBUG face_id.py] Applied torchvision {torchvision.__version__} compatibility shim for GFPGAN")

    from gfpgan import GFPGANer
    HAS_GFPGAN = True
    print("[DEBUG face_id.py] ✅ GFPGAN imported successfully!")
except ImportError as e:
    HAS_GFPGAN = False
    print(f"[DEBUG face_id.py] GFPGAN not installed: {e}")
    print("Install: pip install gfpgan")
except Exception as e:
    HAS_GFPGAN = False
    print(f"[DEBUG face_id.py] GFPGAN load error: {e}")
    print("This may be due to torchvision compatibility issues")


class FaceEnhancer:
    """
    GFPGAN-based face enhancement/restoration.

    Improves face quality after Face Swap or for general face enhancement.
    Uses GFPGAN v1.4 model for high-quality face restoration.
    """

    def __init__(self, device: str = "cuda", upscale: int = 2):
        """
        Initialize face enhancer.

        Args:
            device: "cuda" or "cpu"
            upscale: Upscale factor (1, 2, or 4)
        """
        self.device = device
        self.upscale = upscale
        self.enhancer = None
        self._initialized = False

    def load(self, model_path: str = None) -> bool:
        """
        Load GFPGAN model.

        Args:
            model_path: Path to GFPGAN model (auto-download if None)

        Returns:
            True if loaded successfully
        """
        if not HAS_GFPGAN:
            print("GFPGAN not available")
            return False

        if self._initialized:
            return True

        try:
            import os
            import urllib.request

            # Default model path
            if model_path is None:
                model_dir = os.path.expanduser("~/.cache/gfpgan/weights")
                os.makedirs(model_dir, exist_ok=True)
                model_path = os.path.join(model_dir, "GFPGANv1.4.pth")

                # Download if not exists
                if not os.path.exists(model_path):
                    print("Downloading GFPGAN v1.4 model...")
                    url = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth"
                    urllib.request.urlretrieve(url, model_path)
                    print(f"Downloaded to {model_path}")

            # Initialize GFPGAN
            print(f"Loading GFPGAN on {self.device}...")

            # GFPGAN needs detection model path
            detection_model_path = os.path.join(
                os.path.dirname(model_path),
                "detection_Resnet50_Final.pth"
            )

            # Download detection model if needed
            if not os.path.exists(detection_model_path):
                print("Downloading face detection model...")
                det_url = "https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth"
                urllib.request.urlretrieve(det_url, detection_model_path)

            # Initialize enhancer
            self.enhancer = GFPGANer(
                model_path=model_path,
                upscale=self.upscale,
                arch='clean',
                channel_multiplier=2,
                bg_upsampler=None,  # Don't upscale background
                device=self.device if self.device != "mps" else "cpu"
            )

            self._initialized = True
            print("GFPGAN loaded successfully")
            return True

        except Exception as e:
            print(f"Failed to load GFPGAN: {e}")
            import traceback
            traceback.print_exc()
            return False

    def enhance(
        self,
        image: Union[str, Image.Image, np.ndarray],
        only_center_face: bool = False,
        paste_back: bool = True,
    ) -> Optional[Image.Image]:
        """
        Enhance face quality in image.

        Args:
            image: Input image (path, PIL Image, or numpy array)
            only_center_face: Only enhance the center/largest face
            paste_back: Paste enhanced face back to original

        Returns:
            Enhanced image, or None if failed
        """
        if not self.load():
            return None

        # Convert to numpy BGR
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")

        if isinstance(image, Image.Image):
            img_np = np.array(image)
        else:
            img_np = image

        # RGB to BGR for GFPGAN
        img_bgr = img_np[:, :, ::-1].copy()

        try:
            # Enhance
            _, _, output = self.enhancer.enhance(
                img_bgr,
                has_aligned=False,
                only_center_face=only_center_face,
                paste_back=paste_back
            )

            # BGR to RGB
            output_rgb = output[:, :, ::-1]

            return Image.fromarray(output_rgb)

        except Exception as e:
            print(f"Face enhancement failed: {e}")
            return None

    def enhance_face_region(
        self,
        image: Union[str, Image.Image, np.ndarray],
        face_bbox: tuple = None,
        blend_ratio: float = 0.8,
    ) -> Optional[Image.Image]:
        """
        Enhance only the face region and blend with original.

        Args:
            image: Input image
            face_bbox: Face bounding box (x1, y1, x2, y2), auto-detect if None
            blend_ratio: How much to blend enhanced face (0=original, 1=enhanced)

        Returns:
            Image with enhanced face region
        """
        if not self.load():
            return None

        # Convert to PIL
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")
        elif isinstance(image, np.ndarray):
            image = Image.fromarray(image)

        # Enhance full image
        enhanced = self.enhance(image, only_center_face=True, paste_back=True)

        if enhanced is None:
            return image

        if blend_ratio >= 1.0:
            return enhanced

        # Blend original and enhanced
        original_np = np.array(image).astype(np.float32)
        enhanced_np = np.array(enhanced).astype(np.float32)

        # Resize if needed (GFPGAN might change size due to upscale)
        if original_np.shape != enhanced_np.shape:
            enhanced = enhanced.resize(image.size, Image.LANCZOS)
            enhanced_np = np.array(enhanced).astype(np.float32)

        # Simple blend
        blended = original_np * (1 - blend_ratio) + enhanced_np * blend_ratio
        blended = np.clip(blended, 0, 255).astype(np.uint8)

        return Image.fromarray(blended)


# Quick test
if __name__ == "__main__":
    print("FaceID Module Test")
    print("=" * 50)

    if not HAS_INSIGHTFACE:
        print("InsightFace not installed!")
        print("Install: pip install insightface onnxruntime")
        exit(1)

    # Test face extractor
    extractor = FaceIDExtractor(device="cpu")

    if extractor.load():
        print("InsightFace loaded successfully")

        # Test with sample image if exists
        test_image = "test_face.jpg"
        if os.path.exists(test_image):
            embedding = extractor.get_embedding(test_image)
            if embedding is not None:
                print(f"Embedding shape: {embedding.shape}")
            else:
                print("No face detected in test image")
    else:
        print("Failed to load InsightFace")
