# Server Monitoring

## 1. docker-compose.yml

```yaml
services:
  nodejs:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: node-app
    restart: unless-stopped
    env_file:
      - .env.production
    command: ["npm", "start"]
    ports:
      - "5000:5000"
    networks:
      - monitoring
      - backend
    logging:
      driver: json-file
      options:
        max-size: "150m"
        max-file: "3"
        compress: "true"

  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data
    networks:
      - monitoring

  minio-init:
    image: minio/mc:latest
    container_name: minio-init
    depends_on:
      - minio
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    entrypoint: >
      /bin/sh -c "
      until mc alias set local http://minio:9000
      $$MINIO_ROOT_USER $$MINIO_ROOT_PASSWORD; do
        sleep 2;
      done;
      mc mb --ignore-existing local/loki;
      exit 0;
      "
    networks:
      - monitoring

  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: unless-stopped
    command:
      - "-config.file=/etc/loki/loki-config.yaml"
      - "-config.expand-env"
    environment:
      LOKI_S3_ACCESS_KEY: ${LOKI_S3_ACCESS_KEY}
      LOKI_S3_SECRET_KEY: ${LOKI_S3_SECRET_KEY}
    ports:
      - "3100:3100"
    volumes:
      - ~/monitoring-config/loki-config.yaml:/etc/loki/loki-config.yaml:ro
      - loki-data:/loki
    depends_on:
      minio-init:
        condition: service_completed_successfully
    networks:
      - monitoring

  alloy:
    image: grafana/alloy:latest
    container_name: alloy
    restart: unless-stopped
    user: "0:0"
    command:
      - run
      - /etc/alloy/config.alloy
    volumes:
      - ~/monitoring-config/alloy-config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - alloy-data:/var/lib/alloy
    depends_on:
      - loki
    networks:
      - monitoring

  prom-server:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ~/monitoring-config/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--web.enable-lifecycle"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana-oss:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - loki
      - prom-server
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge
  backend:
    external: true

volumes:
  minio-data:
  loki-data:
  prometheus-data:
  grafana-data:
  alloy-data:
```

## 2. Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm prune --omit=dev

EXPOSE 5000

CMD ["npm", "start"]
```

## 3. Environment Variables

**File:** `.env.production`

```dotenv
NODE_ENV =
PORT =
LOG_LEVEL = info
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=

LOKI_S3_ACCESS_KEY=
LOKI_S3_SECRET_KEY=

GRAFANA_ADMIN_USER=
GRAFANA_ADMIN_PASSWORD=
```

## 4. Grafana Alloy Configuration

`alloy-config.alloy`

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
  refresh_interval = "5s"
}

discovery.relabel "nodejs" {
  targets = discovery.docker.containers.targets

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex = "^/medicare$"
    action = "keep"
  }

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex = "/(.*)"
    target_label = "container"
  }

  rule {
    source_labels = [
      "__meta_docker_container_label_com_docker_compose_service",
    ]
    target_label = "service"
  }

  rule {
    source_labels = [
      "__meta_docker_container_label_com_docker_compose_project",
    ]
    target_label = "compose_project"
  }
}

loki.source.docker "nodejs" {
  host = "unix:///var/run/docker.sock"
  targets = discovery.relabel.nodejs.output

  labels = {
    job = "nodejs",
  }

  forward_to = [
    loki.write.default.receiver,
  ]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
    batch_wait = "1s"
    batch_size = "1MiB"
  }
}
```

## 5. Loki Configuration

`loki-config.yaml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  replication_factor: 1

  ring:
    kvstore:
      store: inmemory

  storage:
    s3:
      endpoint: http://minio:9000
      bucketnames: loki
      access_key_id: ${LOKI_S3_ACCESS_KEY}
      secret_access_key: ${LOKI_S3_SECRET_KEY}
      insecure: true
      s3forcepathstyle: true

schema_config:
  configs:
    - from: 2026-01-01
      store: tsdb
      object_store: s3
      schema: v13
      index:
        prefix: loki_index_
        period: 24h

storage_config:
  aws:
    endpoint: http://minio:9000
    bucketnames: loki
    access_key_id: ${LOKI_S3_ACCESS_KEY}
    secret_access_key: ${LOKI_S3_SECRET_KEY}
    insecure: true
    s3forcepathstyle: true

  tsdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/index_cache

ingester:
  wal:
    enabled: true
    dir: /loki/wal

querier:
  max_concurrent: 4

limits_config:
  retention_period: 168h
  allow_structured_metadata: true
  volume_enabled: true

compactor:
  working_directory: /loki/compactor
  retention_enabled: true
  delete_request_store: s3
  compaction_interval: 10m
  retention_delete_delay: 2h

analytics:
  reporting_enabled: false
```

## 6. Prometheus Configuration

`prometheus.yml`

```yaml
global:
  scrape_interval: 4s
  evaluation_interval: 4s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets:
          - "prometheus:9090"

  - job_name: "nodejs"
    metrics_path: /metrics
    static_configs:
      - targets:
          - "nodejs:5000"
```

## 7. Start the Services

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

## 8. Service URLs

- Nodejs App: `http://localhost:5000`
- MinIO Console: `http://localhost:9001`
- Loki: `http://localhost:3100`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
