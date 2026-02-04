"""
FaceID Module for Inpainting Pipeline
InsightFace-based face embedding extraction for IP-Adapter FaceID Plus v2

Usage:
    face_id = FaceIDExtractor(device="mps")
    embedding = face_id.get_embedding(face_image)

    # With pipeline
    pipe.load_ip_adapter(..., weight_name="ip-adapter-faceid-plusv2_sdxl.bin")
    result = pipe(..., ip_adapter_image_embeds=embedding)
"""

import os
import torch
import numpy as np
from PIL import Image
from typing import Optional, Tuple, Union

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
