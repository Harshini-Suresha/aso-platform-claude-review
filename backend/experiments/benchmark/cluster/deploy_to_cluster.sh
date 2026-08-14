#!/bin/bash
# Sync code + cleaned data to Nargis shared storage.
# Run ON YOUR LAPTOP. Replace USER, HOST, and SSH options as needed.
#
# Usage: bash deploy_to_cluster.sh
set -euo pipefail

USERNAME=${USER}
HOST="login.nargis"            # CHANGE: your cluster hostname
BASE="/cluster/share/${USERNAME}"

echo "==> rsync code + data to ${HOST}:${BASE}/aso"
rsync -avz --exclude node_modules --exclude .git \
  backend/data_curation/          ${HOST}:${BASE}/aso/backend/data_curation/
rsync -avz --exclude node_modules --exclude .git \
  backend/experiments/benchmark/  ${HOST}:${BASE}/aso/backend/experiments/benchmark/
rsync -avz \
  backend/data/benchmark/aso_atlas_clean.parquet \
  ${HOST}:${BASE}/aso/backend/data/benchmark/

echo "==> Done. On the cluster:"
echo "    ssh ${HOST}"
echo "    cd ${BASE}/aso"
echo "    bash backend/experiments/benchmark/cluster/setup_env.sh   # once"
echo "    qsub backend/experiments/benchmark/cluster/run_ranker.qsub"
