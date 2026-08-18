# syntax=docker/dockerfile:1

# Stage 1: Build the Python web-server deps into a venv
# (apt lists, pip, and build caches stay out of the final image)
FROM debian:trixie-slim AS pybuilder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
COPY requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

# Stage 2: Runtime
FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive \
    SHELL=/bin/bash \
    HOME=/root \
    PATH=/opt/venv/bin:$PATH

# base tools + the learning-tool set (vim, git, ssh, ping, dnsutils)
# python3 stays for the venv symlink and patch_kubeconfig.py
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        jq \
        vim \
        git \
        openssh-client \
        sudo \
        iputils-ping \
        dnsutils \
        python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pybuilder /opt/venv /opt/venv

# Install kubectl
ARG TARGETARCH
ARG KUBECTL_VERSION=v1.30.2
RUN curl -fsSL -o /usr/local/bin/kubectl \
        "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" \
    && chmod +x /usr/local/bin/kubectl

# Install helm (pinned release tarball)
ARG HELM_VERSION=v3.16.4
RUN curl -fsSL -o /tmp/helm.tgz "https://get.helm.sh/helm-${HELM_VERSION}-linux-${TARGETARCH}.tar.gz" \
    && tar -xzf /tmp/helm.tgz -C /tmp \
    && install "/tmp/linux-${TARGETARCH}/helm" /usr/local/bin/helm \
    && rm -rf /tmp/helm.tgz "/tmp/linux-${TARGETARCH}"

# Install k9s
ARG K9S_VERSION=v0.32.5
RUN curl -fsSL -o /tmp/k9s.tgz "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_${TARGETARCH}.tar.gz" \
    && tar -xzf /tmp/k9s.tgz -C /usr/local/bin k9s \
    && chmod +x /usr/local/bin/k9s \
    && rm /tmp/k9s.tgz

# shell completions for students
RUN kubectl completion bash > /etc/bash_completion.d/kubectl 2>/dev/null || true \
    && helm completion bash > /etc/bash_completion.d/helm 2>/dev/null || true \
    && k9s completion bash > /etc/bash_completion.d/k9s 2>/dev/null || true

WORKDIR /app
COPY main.py /app/main.py
COPY session.py /app/session.py
COPY patch_kubeconfig.py /app/patch_kubeconfig.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV KUBECONFIG=/root/.kube/config

EXPOSE 3458

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:3458/health || exit 1

# Runs as root by default to read the mounted kubeconfig volume.
# The kubeconfig is mounted from the host's ~/.kube and is owned by root
# inside the container. To run as non-root, adjust the mount ownership.
CMD ["/app/entrypoint.sh"]
