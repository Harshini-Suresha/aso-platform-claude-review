#!/bin/bash
# Setup Python 3 + CPU torch env on Nargis (SGE, CPU-only cluster).
# Run ON THE CLUSTER (login node), from /cluster/share/$USER.
#
# Usage: bash setup_env.sh
#
# Requires internet on the login node (miniconda download). If no internet:
#   see the conda-pack fallback at the bottom of the file.
set -euo pipefail

USERNAME=${USER}
BASE="/cluster/share/${USERNAME}"
CONDA_PREFIX="${BASE}/miniconda3"
ENV_NAME="aso-env"

echo "==> Working in ${BASE}"

if [ ! -d "${CONDA_PREFIX}" ]; then
  echo "==> Installing miniconda3 into ${CONDA_PREFIX}"
  curl -fsSL https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh \
    -o /tmp/miniconda.sh
  bash /tmp/miniconda.sh -b -p "${CONDA_PREFIX}"
fi

source "${CONDA_PREFIX}/etc/profile.d/conda.sh"

if ! conda env list | grep -q "${ENV_NAME}"; then
  echo "==> Creating conda env ${ENV_NAME} (python 3.9, CPU torch)"
  conda create -y -n "${ENV_NAME}" python=3.9 pip
fi
conda activate "${ENV_NAME}"

echo "==> Installing packages (CPU wheels)"
pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
pip install --no-cache-dir \
  numpy pandas pyarrow scipy scikit-learn lightgbm pyyaml

echo "==> Verify"
python - <<'EOF'
import torch, numpy, pandas, lightgbm
print("torch", torch.__version__, "| cpu ok:", not torch.cuda.is_available())
print("pandas", pandas.__version__, "numpy", numpy.__version__, "lightgbm", lightgbm.__version__)
EOF

echo "==> Done. Job scripts should source:"
echo "    source ${CONDA_PREFIX}/etc/profile.d/conda.sh && conda activate ${ENV_NAME}"

# ---------------------------------------------------------------------------
# NO-INTERNET FALLBACK (run on YOUR LAPTOP, not the cluster):
#   cd aso-platform
#   conda create -y -n aso-env python=3.9
#   conda activate aso-env
#   pip install torch --index-url https://download.pytorch.org/whl/cpu
#   pip install numpy pandas pyarrow scipy scikit-learn lightgbm pyyaml
#   conda install -y conda-pack && conda pack -n aso-env -o aso-env.tar.gz
#   scp aso-env.tar.gz ${USER}@login.nargis:/cluster/share/${USER}/
#   # on cluster:
#   mkdir -p ${BASE}/aso-env && tar -xzf aso-env.tar.gz -C ${BASE}/aso-env
#   source ${BASE}/aso-env/bin/activate
# ---------------------------------------------------------------------------
