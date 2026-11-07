FROM node:20-bookworm-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install XeTeX, required LaTeX packages, and Hebrew / Unicode fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-lang-other \
    texlive-science \
    texlive-pictures \
    culmus \
    fonts-freefont-otf \
    fonts-dejavu-core \
    ghostscript \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications first for efficient layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY server.js ./

# Microservice port (Railway, Render, Fly.io automatically supply PORT)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
