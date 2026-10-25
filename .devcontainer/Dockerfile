FROM mcr.microsoft.com/devcontainers/typescript-node:5.2.3-24-bookworm

# Pin the patched Node.js release used by local development and builds.
ARG NODE_VERSION=24.22.1
RUN su node -c ". /usr/local/share/nvm/nvm.sh && nvm install ${NODE_VERSION} && nvm alias default ${NODE_VERSION}"
ENV PATH="/usr/local/share/nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"
