"""
Gemini Vision 기반 프롬프트 생성기
얼굴 이미지를 분석하여 SDXL 인페인팅에 적합한 프롬프트 자동 생성
"""

import os
from pathlib import Path


def load_api_key():
    """
    .env 파일에서 GEMINI_API_KEY 로드

    Returns:
        API 키 (str) 또는 None
    """
    # 현재 파일 기준 .env 경로
    env_path = Path(__file__).parent / ".env"

    if not env_path.exists():
        return None

    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('GEMINI_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")

    return None


def generate_prompt_from_face_image(face_image_path: str) -> str:
    """
    Gemini Vision으로 얼굴 이미지를 분석해서 맞춤형 프롬프트 생성

    Args:
        face_image_path: 분석할 얼굴 이미지 경로

    Returns:
        생성된 프롬프트 (str)
    """
    DEFAULT_PROMPT = "young adult, neutral skin tone, natural features, soft facial structure"

    try:
        from google import genai
        from PIL import Image
    except ImportError:
        print("   google-genai 패키지가 없습니다. 기본 프롬프트를 사용합니다.")
        return DEFAULT_PROMPT

    # API 키 로드
    api_key = load_api_key()
    if not api_key:
        print("   GEMINI_API_KEY가 설정되지 않았습니다. 기본 프롬프트를 사용합니다.")
        print("   (.env 파일에 GEMINI_API_KEY=your_key 형식으로 설정하세요)")
        return DEFAULT_PROMPT

    client = genai.Client(api_key=api_key)

    system_prompt = """
You are an expert prompt engineer for Stable Diffusion SDXL image generation with InstantID ControlNet.

**CONTEXT**: This prompt will be used with InstantID face preservation technology. The face itself is already preserved at 99% accuracy, so DO NOT describe facial features like eye shape, nose shape, or mouth details.

**YOUR TASK**: Analyze this face image and generate ONLY the following descriptive elements:

1. **Age & Gender** (required):
   - Examples: "young woman in her 20s", "middle-aged man", "teenage girl", "man in his 30s"

2. **Ethnicity/Race** (if clearly identifiable):
   - Examples: "East Asian", "Korean", "Caucasian", "African", "South Asian", "Hispanic"
   - If uncertain, SKIP this element

3. **Skin Tone** (required):
   - Choose ONE: "fair skin", "light skin", "medium skin tone", "olive skin", "tan skin", "dark skin"

4. **Overall Facial Structure** (required):
   - Choose descriptors like: "soft facial features", "sharp jawline", "round face", "oval face", "angular features", "delicate features", "strong bone structure"

5. **General Impression & Vibe** (encouraged, add multiple):
   - Examples: "youthful appearance", "mature look", "gentle features", "refined appearance", "fresh-faced", "radiant complexion", "natural beauty", "elegant demeanor", "approachable look"

6. **Additional Atmospheric Details** (optional):
   - Hair color/style impression: "dark hair", "light brown hair", "long hair"
   - Overall mood: "confident", "warm", "professional", "casual elegance"

**FORMATTING RULES**:
- Output ONLY comma-separated phrases
- Be descriptive and detailed (50-80 words is ideal)
- NO quotation marks, NO markdown, NO explanations
- Start with age/gender, then ethnicity (if clear), then skin tone, then structure, then additional details
- Use professional, neutral language
- Focus on what would help the AI understand the general demographic and appearance category

**EXAMPLE OUTPUTS**:
young Korean woman in her 20s, fair skin, soft facial features, delicate bone structure, youthful appearance, radiant complexion, natural beauty, dark hair, warm and approachable demeanor, fresh-faced look, elegant casual style
middle-aged man, medium skin tone, strong jawline, angular features, mature appearance, confident look, professional demeanor, refined features, well-groomed appearance
teenage girl, light skin, round face, youthful features, gentle expression, fresh complexion, casual and natural vibe, long hair, approachable personality

Now analyze the image and generate the prompt:
"""

    try:
        # 이미지 로드
        image = Image.open(face_image_path)

        # Gemini Vision으로 이미지 분석
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[system_prompt, image]
        )

        prompt = response.text.strip()

        # 정제 과정
        prompt = prompt.replace('```', '').replace('"', '').replace("'", '').strip()

        # 유효성 검사
        if not prompt or len(prompt) < 15:
            print("   Gemini 분석 결과가 너무 짧습니다. 기본 프롬프트 사용.")
            return DEFAULT_PROMPT

        return prompt

    except Exception as e:
        print(f"   Gemini API 오류: {e}. 기본 프롬프트를 사용합니다.")
        return DEFAULT_PROMPT


# 모듈 테스트용
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python prompt_generator.py <face_image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    prompt = generate_prompt_from_face_image(image_path)
    print(f"\n생성된 프롬프트:\n{prompt}")
