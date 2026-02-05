#!/bin/bash
# Celery workers 자동 시작 스크립트 (GPU 5, 6, 7)

cd /home/yongbin53/Prometheus_4team/ip-to-portrait/web/backend

# 로그 디렉토리
LOG_DIR="/home/yongbin53/Prometheus_4team/ip-to-portrait/logs"
mkdir -p $LOG_DIR

# 기존 worker 종료
pkill -f "celery -A tasks worker" 2>/dev/null
sleep 1

echo "Starting Celery workers on GPU 5, 6, 7..."
echo "Logs: $LOG_DIR/worker*.log"

# GPU 5 worker
CUDA_VISIBLE_DEVICES=5 celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker5@%h >> $LOG_DIR/worker5.log 2>&1 &
echo "Worker 5 started (PID: $!)"

# GPU 6 worker
CUDA_VISIBLE_DEVICES=6 celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker6@%h >> $LOG_DIR/worker6.log 2>&1 &
echo "Worker 6 started (PID: $!)"

# GPU 7 worker
CUDA_VISIBLE_DEVICES=7 celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker7@%h >> $LOG_DIR/worker7.log 2>&1 &
echo "Worker 7 started (PID: $!)"

echo ""
echo "All workers started!"
echo ""
echo "팀원들이 로그 보는 방법:"
echo "  tail -f $LOG_DIR/worker5.log  # GPU 5 워커"
echo "  tail -f $LOG_DIR/worker6.log  # GPU 6 워커"
echo "  tail -f $LOG_DIR/worker7.log  # GPU 7 워커"
echo "  tail -f $LOG_DIR/worker*.log  # 모든 워커"
echo ""
echo "Stop all workers with: pkill -f 'celery -A tasks worker'"
