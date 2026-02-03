"""
Face Parsing Module for Inpainting Pipeline
BiSeNet-based face+hair segmentation

Labels:
    17: hair
    1-13: face features (skin, eyes, nose, mouth, etc.)
"""

import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageFilter
from typing import Optional, Tuple, Union
import torchvision.transforms as transforms
from torchvision.models import resnet18


# BiSeNet Labels (19 classes)
# 0: background, 1: skin, 2-3: brows, 4-5: eyes, 6: glasses, 7-8: ears,
# 9: earring, 10: nose, 11: mouth, 12-13: lips, 14: neck, 15: necklace,
# 16: cloth, 17: hair, 18: hat
BISENET_FACE_LABELS = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13]  # Face features
BISENET_HAIR_LABELS = [17]  # Hair only
BISENET_NECK_LABELS = [14]  # Neck
BISENET_FACE_HAIR_LABELS = BISENET_FACE_LABELS + BISENET_HAIR_LABELS


# BiSeNet Model Components
class ConvBNReLU(nn.Module):
    def __init__(self, in_chan, out_chan, ks=3, stride=1, padding=1):
        super(ConvBNReLU, self).__init__()
        self.conv = nn.Conv2d(in_chan, out_chan, kernel_size=ks, stride=stride, padding=padding, bias=False)
        self.bn = nn.BatchNorm2d(out_chan)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))


class BiSeNetOutput(nn.Module):
    def __init__(self, in_chan, mid_chan, n_classes):
        super(BiSeNetOutput, self).__init__()
        self.conv = ConvBNReLU(in_chan, mid_chan, ks=3, stride=1, padding=1)
        self.conv_out = nn.Conv2d(mid_chan, n_classes, kernel_size=1, bias=False)

    def forward(self, x):
        return self.conv_out(self.conv(x))


class AttentionRefinementModule(nn.Module):
    def __init__(self, in_chan, out_chan):
        super(AttentionRefinementModule, self).__init__()
        self.conv = ConvBNReLU(in_chan, out_chan, ks=3, stride=1, padding=1)
        self.conv_atten = nn.Conv2d(out_chan, out_chan, kernel_size=1, bias=False)
        self.bn_atten = nn.BatchNorm2d(out_chan)
        self.sigmoid_atten = nn.Sigmoid()

    def forward(self, x):
        feat = self.conv(x)
        atten = F.avg_pool2d(feat, feat.size()[2:])
        atten = self.sigmoid_atten(self.bn_atten(self.conv_atten(atten)))
        return torch.mul(feat, atten)


class ContextPath(nn.Module):
    def __init__(self):
        super(ContextPath, self).__init__()
        self.resnet = resnet18(weights=None)
        self.arm16 = AttentionRefinementModule(256, 128)
        self.arm32 = AttentionRefinementModule(512, 128)
        self.conv_head32 = ConvBNReLU(128, 128, ks=3, stride=1, padding=1)
        self.conv_head16 = ConvBNReLU(128, 128, ks=3, stride=1, padding=1)
        self.conv_avg = ConvBNReLU(512, 128, ks=1, stride=1, padding=0)

    def forward(self, x):
        feat8, feat16, feat32 = self._get_resnet_features(x)
        H8, W8 = feat8.size()[2:]
        H16, W16 = feat16.size()[2:]
        H32, W32 = feat32.size()[2:]

        avg = F.avg_pool2d(feat32, feat32.size()[2:])
        avg = self.conv_avg(avg)
        avg_up = F.interpolate(avg, (H32, W32), mode='nearest')

        feat32_arm = self.arm32(feat32)
        feat32_sum = feat32_arm + avg_up
        feat32_up = F.interpolate(feat32_sum, (H16, W16), mode='nearest')
        feat32_up = self.conv_head32(feat32_up)

        feat16_arm = self.arm16(feat16)
        feat16_sum = feat16_arm + feat32_up
        feat16_up = F.interpolate(feat16_sum, (H8, W8), mode='nearest')
        feat16_up = self.conv_head16(feat16_up)

        return feat8, feat16_up

    def _get_resnet_features(self, x):
        x = self.resnet.conv1(x)
        x = self.resnet.bn1(x)
        x = self.resnet.relu(x)
        x = self.resnet.maxpool(x)
        feat8 = self.resnet.layer1(x)
        feat8 = self.resnet.layer2(feat8)
        feat16 = self.resnet.layer3(feat8)
        feat32 = self.resnet.layer4(feat16)
        return feat8, feat16, feat32


class FeatureFusionModule(nn.Module):
    def __init__(self, in_chan, out_chan):
        super(FeatureFusionModule, self).__init__()
        self.convblk = ConvBNReLU(in_chan, out_chan, ks=1, stride=1, padding=0)
        self.conv1 = nn.Conv2d(out_chan, out_chan // 4, kernel_size=1, stride=1, padding=0, bias=False)
        self.conv2 = nn.Conv2d(out_chan // 4, out_chan, kernel_size=1, stride=1, padding=0, bias=False)
        self.relu = nn.ReLU(inplace=True)
        self.sigmoid = nn.Sigmoid()

    def forward(self, fsp, fcp):
        fcat = torch.cat([fsp, fcp], dim=1)
        feat = self.convblk(fcat)
        atten = F.avg_pool2d(feat, feat.size()[2:])
        atten = self.relu(self.conv1(atten))
        atten = self.sigmoid(self.conv2(atten))
        return torch.mul(feat, atten) + feat


class BiSeNet(nn.Module):
    def __init__(self, n_classes=19):
        super(BiSeNet, self).__init__()
        self.cp = ContextPath()
        self.ffm = FeatureFusionModule(256, 256)
        self.conv_out = BiSeNetOutput(256, 256, n_classes)

    def forward(self, x):
        H, W = x.size()[2:]
        feat_res8, feat_cp8 = self.cp(x)
        feat_fuse = self.ffm(feat_res8, feat_cp8)
        feat_out = self.conv_out(feat_fuse)
        feat_out = F.interpolate(feat_out, (H, W), mode='bilinear', align_corners=True)
        return feat_out


class FaceParser:
    """BiSeNet-based face parser for face+hair segmentation."""

    MODEL_FILENAME = "79999_iter.pth"

    def __init__(self, device: str = "cpu"):
        self.device = device
        self.model = None
        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
        ])

    def _find_model_path(self) -> Optional[str]:
        """Find existing model in various cache locations."""
        # Check locations in priority order
        possible_paths = [
            # Main pipeline cache (most likely to exist)
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_cache", "face_parser", self.MODEL_FILENAME),
            # User cache
            os.path.join(os.path.expanduser("~"), ".cache", "bisenet", self.MODEL_FILENAME),
            # Local cache
            os.path.join(os.path.dirname(__file__), "models_cache", self.MODEL_FILENAME),
        ]

        for path in possible_paths:
            if os.path.exists(path):
                print(f"Found BiSeNet model at: {path}")
                return path

        return None

    def _download_model(self, save_path: str) -> bool:
        """Download BiSeNet model with fallback URLs."""
        import urllib.request

        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # Method 1: Try gdown for Google Drive (most reliable)
        try:
            import gdown
            gdrive_id = "154JgKpzCPW82qINcVieuPH3fZ2e0P812"
            print(f"Trying to download from Google Drive (ID: {gdrive_id})...")
            gdown.download(id=gdrive_id, output=save_path, quiet=False)
            if os.path.exists(save_path) and os.path.getsize(save_path) > 1000000:  # > 1MB
                print(f"Downloaded to: {save_path}")
                return True
        except Exception as e:
            print(f"Google Drive download failed: {e}")

        # Method 2: Fallback to direct URLs
        urls = [
            "https://huggingface.co/jonathandinu/face-parsing/resolve/main/79999_iter.pth",
            "https://github.com/zllrunning/face-parsing.PyTorch/releases/download/v1.0/79999_iter.pth",
        ]

        for url in urls:
            try:
                print(f"Trying to download from: {url}")
                urllib.request.urlretrieve(url, save_path)
                if os.path.exists(save_path) and os.path.getsize(save_path) > 1000000:
                    print(f"Downloaded to: {save_path}")
                    return True
            except Exception as e:
                print(f"Failed: {e}")
                continue

        return False

    def load(self) -> bool:
        """Load BiSeNet model."""
        if self.model is not None:
            return True

        try:
            # Try to find existing model first
            model_path = self._find_model_path()

            # If not found, download
            if model_path is None:
                cache_dir = os.path.join(os.path.dirname(__file__), "models_cache")
                model_path = os.path.join(cache_dir, self.MODEL_FILENAME)

                if not self._download_model(model_path):
                    print("All download attempts failed")
                    return False

            # Load model
            self.model = BiSeNet(n_classes=19)
            state_dict = torch.load(model_path, map_location=self.device, weights_only=True)
            self.model.load_state_dict(state_dict, strict=False)
            self.model.to(self.device)
            self.model.eval()
            print(f"BiSeNet loaded on {self.device}")
            return True

        except Exception as e:
            print(f"Failed to load BiSeNet: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_segmentation(
        self,
        image: Image.Image,
        target_size: Tuple[int, int] = None
    ) -> Optional[np.ndarray]:
        """Get segmentation map from image."""
        if not self.load():
            return None

        if target_size is None:
            target_size = image.size

        # Resize for inference (512x512 for best results)
        inference_size = 512
        img_resized = image.resize((inference_size, inference_size), Image.LANCZOS)

        # Transform
        img_tensor = self.transform(img_resized).unsqueeze(0).to(self.device)

        with torch.no_grad():
            output = self.model(img_tensor)
            pred = output.argmax(1).squeeze().cpu().numpy()

        # Resize to target size
        pred_pil = Image.fromarray(pred.astype(np.uint8))
        pred_resized = pred_pil.resize(target_size, Image.NEAREST)

        return np.array(pred_resized)

    def get_face_hair_mask(
        self,
        image: Union[str, Image.Image],
        target_size: Optional[Tuple[int, int]] = None,
        include_hair: bool = True,
        include_neck: bool = False,
        blur_radius: int = 10,
        expand_ratio: float = 1.2
    ) -> Optional[Image.Image]:
        """
        Extract face+hair+neck mask from image.

        Args:
            image: PIL Image or path
            target_size: Output size
            include_hair: Include hair in mask
            include_neck: Include neck in mask
            blur_radius: Gaussian blur for soft edges
            expand_ratio: Mask expansion ratio
        """
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")

        if target_size is None:
            target_size = image.size

        seg_map = self.get_segmentation(image, target_size)

        if seg_map is None:
            return None

        # Create mask from labels
        labels = BISENET_FACE_LABELS.copy()
        if include_hair:
            labels.extend(BISENET_HAIR_LABELS)
        if include_neck:
            labels.extend(BISENET_NECK_LABELS)

        mask = np.zeros(seg_map.shape, dtype=np.uint8)
        for label in labels:
            mask[seg_map == label] = 255

        coverage = np.sum(mask > 0) / mask.size * 100
        print(f"BiSeNet mask coverage: {coverage:.1f}%")

        if coverage < 3:
            print("Coverage too low, mask may be invalid")
            return None

        # Morphological cleanup
        try:
            from scipy import ndimage
            mask = ndimage.binary_fill_holes(mask > 127).astype(np.uint8) * 255

            # Expansion based on ratio
            if expand_ratio > 1.0:
                iterations = int(min(target_size) * 0.02 * (expand_ratio - 1.0))
                if iterations > 0:
                    mask = ndimage.binary_dilation(mask > 127, iterations=iterations).astype(np.uint8) * 255
        except ImportError:
            pass

        # Convert to PIL and blur
        mask_pil = Image.fromarray(mask, mode='L')
        if blur_radius > 0:
            mask_pil = mask_pil.filter(ImageFilter.GaussianBlur(radius=blur_radius))

        return mask_pil

    def extract_hair_region(
        self,
        image: Image.Image,
        background_color: Tuple[int, int, int] = (128, 128, 128)
    ) -> Optional[Image.Image]:
        """
        Extract hair-only region from image.

        Returns image with only hair visible, rest is neutral gray.
        This can be used for CLIP encoding to capture hairstyle.
        """
        seg_map = self.get_segmentation(image, image.size)

        if seg_map is None:
            return None

        # Create hair-only mask (label 17)
        hair_mask = np.zeros(seg_map.shape, dtype=np.uint8)
        hair_mask[seg_map == 17] = 255

        hair_coverage = np.sum(hair_mask > 0) / hair_mask.size * 100
        print(f"Hair coverage: {hair_coverage:.1f}%")

        if hair_coverage < 1:
            print("No significant hair detected")
            return None

        # Morphological cleanup
        try:
            from scipy import ndimage
            hair_mask = ndimage.binary_fill_holes(hair_mask > 127).astype(np.uint8) * 255
            hair_mask = ndimage.binary_dilation(hair_mask > 127, iterations=2).astype(np.uint8) * 255
        except ImportError:
            pass

        # Create output: hair visible, rest neutral gray
        img_array = np.array(image, dtype=np.float32)
        mask_array = hair_mask.astype(np.float32) / 255.0
        mask_array = mask_array[:, :, np.newaxis]

        bg_array = np.array(background_color, dtype=np.float32)
        result = img_array * mask_array + bg_array * (1 - mask_array)
        result = np.clip(result, 0, 255).astype(np.uint8)

        return Image.fromarray(result)

    def get_hair_coverage(self, image: Image.Image) -> float:
        """Get hair coverage percentage in image."""
        seg_map = self.get_segmentation(image, image.size)
        if seg_map is None:
            return 0.0
        return np.sum(seg_map == 17) / seg_map.size * 100

    def detect_gender_from_hair(self, image: Image.Image) -> str:
        """
        Simple gender hint based on hair coverage.

        Note: This is a very rough heuristic. High hair coverage
        often (but not always) correlates with longer hair.
        """
        coverage = self.get_hair_coverage(image)

        if coverage > 15:
            return "likely female (long hair)"
        elif coverage > 8:
            return "ambiguous (medium hair)"
        else:
            return "likely male (short hair)"
