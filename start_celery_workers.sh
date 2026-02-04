#!/bin/bash
# Celery workers 자동 시작 스크립트 (GPU 5, 6, 7)

cd /home/yongbin53/Prometheus_4team/ip-to-portrait/web/backend

# 기존 worker 종료
pkill -f "celery -A tasks worker" 2>/dev/null
sleep 1

echo "Starting Celery workers on GPU 5, 6, 7..."

# GPU 5 worker
CUDA_VISIBLE_DEVICES=5 celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker5@%h &
echo "Worker 5 started (PID: $!)"

# GPU 6 worker
CUDA_VISIBLE_DEVICES=6 celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker6@%h &
echo "Worker 6 started (PID: $!)"

# GPU 7 worker
CUDA_VISIBLE_DEVICES=7 celery -A tasks worker --loglevel=info -Q gpu_queue --concurrency=1 -n worker7@%h &
echo "Worker 7 started (PID: $!)"

echo ""
echo "All workers started! Check with: celery -A tasks inspect active"
echo "Stop all workers with: pkill -f 'celery -A tasks worker'"
