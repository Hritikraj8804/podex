FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    SHELL=/bin/bash \
    HOME=/root

# Install base tools + kubectl (does not require a running cluster to install)
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        curl \
        ca-certificates \
        gnupg \
        jq \
        vim \
        git \
        openssh-client \
        sudo \
        python3 \
        python3-pip \
        apt-transport-https \
        iputils-ping \
        dnsutils \
    && rm -rf /var/lib/apt/lists/*

# Install kubectl
ARG KUBECTL_VERSION=v1.30.2
RUN curl -fsSL -o /usr/local/bin/kubectl \
        "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/$(dpkg --print-architecture)/kubectl" \
    && chmod +x /usr/local/bin/kubectl \
    && kubectl version --client --output=yaml || true

# Install helm
RUN curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash || true

# Install k9s
ARG K9S_VERSION=v0.32.5
RUN curl -fsSL -o /tmp/k9s.tar.gz "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_amd64.tar.gz" \
    && tar -xzf /tmp/k9s.tar.gz -C /usr/local/bin k9s \
    && chmod +x /usr/local/bin/k9s \
    && rm /tmp/k9s.tar.gz || true

# kubectl bash completion
RUN kubectl completion bash > /etc/bash_completion.d/kubectl 2>/dev/null || true

WORKDIR /work
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/requirements.txt

COPY main.py /app/main.py
COPY session.py /app/session.py
COPY patch_kubeconfig.py /app/patch_kubeconfig.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV KUBECONFIG=/root/.kube/config

EXPOSE 3458

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3458/health || exit 1

CMD ["/app/entrypoint.sh"]