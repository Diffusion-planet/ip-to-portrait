#!/bin/bash

echo "🚀 RunPod 초기 세팅을 시작합니다..."

# 1. 기본 패키지 업데이트 및 필수 도구 설치
echo "📦 기본 패키지 업데이트 중..."
apt update -y
apt install -y zsh git curl nano tmux nvtop unzip

# 2. Node.js (NVM) 설치 - Claude Code 구동용
echo "🟢 Node.js (LTS) 설치 중..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts

# 3. Claude Code 설치
echo "🤖 Claude Code 설치 중..."
npm install -g @anthropic-ai/claude-code
# 경로 강제 추가 (설치 직후 바로 실행되게 하기 위함)
export PATH=$PATH:$(npm config get prefix)/bin

# 4. Oh My Zsh 설치 (무인 설치 모드)
echo "🎨 Oh My Zsh 설치 중..."
# 이미 설치되어 있으면 삭제 후 재설치 (꼬임 방지)
rm -rf ~/.oh-my-zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# 5. Zsh 플러그인 설치 (자동완성, 구문강조)
echo "🔌 플러그인 다운로드 중..."
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

# 6. .zshrc 설정 파일 수정
echo "⚙️ .zshrc 설정 적용 중..."

# 테마 설정 (agnoster: 화살표 모양 인기 테마)
# 폰트가 깨지면 'robbyrussell'로 바꾸세요.
sed -i 's/ZSH_THEME="robbyrussell"/ZSH_THEME="agnoster"/' ~/.zshrc

# 플러그인 활성화
sed -i 's/plugins=(git)/plugins=(git zsh-autosuggestions zsh-syntax-highlighting)/' ~/.zshrc

# NVM 및 Claude 경로 영구 추가
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.zshrc
echo 'export PATH=$PATH:$(npm config get prefix)/bin' >> ~/.zshrc

# 7. 접속 시 자동으로 Zsh 실행되게 설정
if ! grep -q "exec zsh" ~/.bashrc; then
    echo "if [ -t 1 ]; then exec zsh; fi" >> ~/.bashrc
fi

# ==========================================
# 8. VS Code 확장 프로그램 자동 설치 (한국어 포함)
# ==========================================
echo "🧩 VS Code 확장 프로그램 설치 시도..."

if command -v code &> /dev/null; then
    echo "✅ VS Code 환경이 감지되었습니다."

    echo "⬇️ 'Claude Code' 설치 중..."
    code --install-extension anthropic.claude-code --force

    echo "🇰🇷 '한국어 언어 팩' 설치 중..."
    code --install-extension MS-CEINTL.vscode-language-pack-ko --force

    echo "✨ 설치 완료! 언어 변경을 위해 VS Code를 재시작하라는 알림이 뜰 수 있습니다."
else
    echo "⚠️ VS Code 내부 터미널이 아니어서 확장을 설치할 수 없습니다."
fi

echo "✅ 모든 설치가 완료되었습니다!"
echo "👉 이제 'zsh'를 입력하거나 터미널을 재시작하세요."
echo "👉 Claude 로그인이 필요하면 'claude'를 입력하세요."

# 바로 zsh로 전환
exec zsh


# 사용 방법
# bash /workspace/setup.sh
