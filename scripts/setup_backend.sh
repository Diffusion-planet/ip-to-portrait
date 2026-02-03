#!/bin/bash
# =============================================================================
# IP-to-Portrait Backend Setup Script (Runpod Environment)
# =============================================================================
# 실행 명령어:
#   bash scripts/setup_backend.sh
# =============================================================================
# This script sets up the backend environment including:
# - PostgreSQL (direct installation, no Docker)
# - Redis (direct installation, no Docker)
# - Python venv with requirements
# - Database migration
# - Environment configuration
# - Celery worker setup
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"

# Database configuration
DB_USER="fastface"
DB_NAME="fastface"
DB_PORT="5433"
REDIS_PORT="6379"

# Try to read password from existing .env file first
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    EXISTING_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
    if [ -n "$EXISTING_PASSWORD" ]; then
        DB_PASSWORD="$EXISTING_PASSWORD"
    else
        DB_PASSWORD="${POSTGRES_PASSWORD:-fastface_password_123}"
    fi
else
    DB_PASSWORD="${POSTGRES_PASSWORD:-fastface_password_123}"
fi

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  IP-to-Portrait Backend Setup${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# 1. Update package list and install dependencies
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/8] Installing system dependencies...${NC}"

apt-get update -qq

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}Installing PostgreSQL...${NC}"
    apt-get install -y -qq postgresql postgresql-contrib
    echo -e "${GREEN}PostgreSQL installed!${NC}"
else
    echo -e "${GREEN}PostgreSQL already installed.${NC}"
fi

# Install Redis
if ! command -v redis-server &> /dev/null; then
    echo -e "${YELLOW}Installing Redis...${NC}"
    apt-get install -y -qq redis-server
    echo -e "${GREEN}Redis installed!${NC}"
else
    echo -e "${GREEN}Redis already installed.${NC}"
fi

# -----------------------------------------------------------------------------
# 2. Start PostgreSQL and configure
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/8] Configuring PostgreSQL...${NC}"

# Start PostgreSQL service
service postgresql start || true
sleep 2

# Wait for PostgreSQL to be ready
max_retries=30
counter=0
until su - postgres -c "pg_isready" 2>/dev/null; do
    counter=$((counter + 1))
    if [ $counter -ge $max_retries ]; then
        echo -e "${RED}PostgreSQL failed to start!${NC}"
        exit 1
    fi
    echo "Waiting for PostgreSQL to start... ($counter/$max_retries)"
    sleep 1
done

echo -e "${GREEN}PostgreSQL is running!${NC}"

# Create database user and database
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1" || \
su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1" || \
su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""

su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""

# Configure PostgreSQL to allow password authentication
PG_HBA=$(su - postgres -c "psql -t -c 'SHOW hba_file';" | xargs)
if [ -f "$PG_HBA" ]; then
    # Add md5 authentication for local connections
    if ! grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$PG_HBA"; then
        echo "host    all             all             127.0.0.1/32            md5" >> "$PG_HBA"
        service postgresql reload
    fi
fi

# Configure PostgreSQL to listen on port 5433
PG_CONF=$(su - postgres -c "psql -t -c 'SHOW config_file';" | xargs)
if [ -f "$PG_CONF" ]; then
    sed -i "s/#port = 5432/port = $DB_PORT/" "$PG_CONF" 2>/dev/null || true
    sed -i "s/port = 5432/port = $DB_PORT/" "$PG_CONF" 2>/dev/null || true
    service postgresql restart
    sleep 2
fi

echo -e "${GREEN}PostgreSQL configured: User=$DB_USER, DB=$DB_NAME, Port=$DB_PORT${NC}"

# -----------------------------------------------------------------------------
# 3. Start Redis
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[3/8] Starting Redis...${NC}"

# Start Redis service
service redis-server start || redis-server --daemonize yes || true
sleep 1

# Verify Redis is running
if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}Redis is running on port $REDIS_PORT!${NC}"
else
    echo -e "${YELLOW}Starting Redis manually...${NC}"
    redis-server --daemonize yes --port $REDIS_PORT
    sleep 1
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}Redis started successfully!${NC}"
    else
        echo -e "${RED}Failed to start Redis!${NC}"
    fi
fi

# -----------------------------------------------------------------------------
# 4. Create Python virtual environment
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[4/8] Setting up Python virtual environment...${NC}"

cd "$PROJECT_ROOT"

if [ ! -d "$VENV_DIR" ] || [ ! -f "$VENV_DIR/bin/activate" ]; then
    echo -e "${YELLOW}Creating venv at $VENV_DIR...${NC}"
    rm -rf "$VENV_DIR" 2>/dev/null || true
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}venv created!${NC}"
else
    echo -e "${GREEN}venv already exists at $VENV_DIR${NC}"
fi

# Define venv executables
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

# Verify venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${RED}Error: venv Python not found at $VENV_PYTHON${NC}"
    exit 1
fi

# Upgrade pip
"$VENV_PIP" install --upgrade pip -q

echo -e "${GREEN}venv ready: $VENV_PYTHON${NC}"

# -----------------------------------------------------------------------------
# 5. Install Python requirements
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[5/8] Installing Python requirements...${NC}"

"$VENV_PIP" install -r "$PROJECT_ROOT/requirements.txt" -q

echo -e "${GREEN}Python requirements installed!${NC}"

# -----------------------------------------------------------------------------
# 6. Create/Update .env file
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[6/8] Configuring environment variables...${NC}"

ENV_FILE="$PROJECT_ROOT/.env"

# Generate a random secret key if not exists
SECRET_KEY=$("$VENV_PYTHON" -c "import secrets; print(secrets.token_urlsafe(32))")

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << EOF
# Gemini API Key for prompt generation
# Get your key from: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# PostgreSQL Database
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}
POSTGRES_PASSWORD=${DB_PASSWORD}

# JWT Secret Key
SECRET_KEY=${SECRET_KEY}

# Celery Configuration
USE_CELERY=true
REDIS_URL=redis://localhost:${REDIS_PORT}/0
EOF
    echo -e "${GREEN}.env file created at $ENV_FILE${NC}"
else
    echo -e "${GREEN}.env file already exists.${NC}"
    echo -e "${YELLOW}Please verify the database settings in $ENV_FILE${NC}"
fi

# -----------------------------------------------------------------------------
# 7. Run database migrations
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[7/8] Running database migrations...${NC}"

cd "$BACKEND_DIR"

# Set environment variables for alembic
export DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
export SECRET_KEY="${SECRET_KEY}"

# Run Alembic migrations using venv
"$VENV_DIR/bin/alembic" upgrade head

echo -e "${GREEN}Database migrations completed!${NC}"

# -----------------------------------------------------------------------------
# 8. Create startup scripts
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[8/8] Creating startup helper scripts...${NC}"

# Create backend start script
cat > "$SCRIPT_DIR/start_backend.sh" << 'EOF'
#!/bin/bash
# Start IP-to-Portrait Backend Server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"

# Activate venv
source "$VENV_DIR/bin/activate"

# Start services if not running
service postgresql start 2>/dev/null || true
redis-server --daemonize yes 2>/dev/null || true

cd "$BACKEND_DIR"
echo "Starting backend server on http://0.0.0.0:8008"
python main.py
EOF
chmod +x "$SCRIPT_DIR/start_backend.sh"

# Create Celery worker start script
cat > "$SCRIPT_DIR/start_celery.sh" << 'EOF'
#!/bin/bash
# Start Celery Worker for parallel GPU processing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/web/backend"
VENV_DIR="$PROJECT_ROOT/venv"

# Activate venv
source "$VENV_DIR/bin/activate"

cd "$BACKEND_DIR"
echo "Starting Celery worker..."
celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1
EOF
chmod +x "$SCRIPT_DIR/start_celery.sh"

# Create all-in-one start script
cat > "$SCRIPT_DIR/start_all.sh" << 'EOF'
#!/bin/bash
# Start all IP-to-Portrait services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "  Starting IP-to-Portrait Services"
echo "============================================="

# Ensure services are running
echo "[1/4] Starting PostgreSQL..."
service postgresql start 2>/dev/null || true

echo "[2/4] Starting Redis..."
redis-server --daemonize yes 2>/dev/null || true

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Activate venv
source "$PROJECT_ROOT/venv/bin/activate"

# Start Celery in background
echo "[3/4] Starting Celery worker in background..."
cd "$PROJECT_ROOT/web/backend"
nohup celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 > /tmp/celery.log 2>&1 &
CELERY_PID=$!
echo "Celery worker started (PID: $CELERY_PID)"

# Start frontend in background
echo "[4/4] Starting Frontend in background..."
cd "$PROJECT_ROOT/web/frontend"
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

sleep 3

echo ""
echo "============================================="
echo "  All services started!"
echo "============================================="
echo ""
echo "Frontend:  http://localhost:3008"
echo "Backend:   http://localhost:8008"
echo ""
echo "Log files:"
echo "  - Celery:   /tmp/celery.log"
echo "  - Frontend: /tmp/frontend.log"
echo ""
echo "Starting backend server..."
echo ""

# Start backend in foreground
cd "$PROJECT_ROOT/web/backend"
python main.py
EOF
chmod +x "$SCRIPT_DIR/start_all.sh"

echo -e "${GREEN}Startup scripts created!${NC}"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}  Backend Setup Complete!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo -e "  PostgreSQL: localhost:$DB_PORT (User: $DB_USER, DB: $DB_NAME)"
echo -e "  Redis:      localhost:$REDIS_PORT"
echo ""
echo -e "${GREEN}Environment:${NC}"
echo -e "  venv:       $VENV_DIR"
echo -e "  .env:       $ENV_FILE"
echo ""
echo -e "${YELLOW}Startup Commands:${NC}"
echo -e "  Backend only:   ${GREEN}$SCRIPT_DIR/start_backend.sh${NC}"
echo -e "  Celery worker:  ${GREEN}$SCRIPT_DIR/start_celery.sh${NC}"
echo -e "  All services:   ${GREEN}$SCRIPT_DIR/start_all.sh${NC}"
echo ""
echo -e "${YELLOW}Manual start:${NC}"
echo -e "  source $VENV_DIR/bin/activate"
echo -e "  cd $BACKEND_DIR && python main.py"
echo ""
echo -e "${RED}Important:${NC}"
echo -e "  Don't forget to set your GEMINI_API_KEY in $ENV_FILE"
echo ""
