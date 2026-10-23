#!/bin/sh
# Run on the EC2 API server as ec2-user: pulls the checked-out branch, rebuilds the image and swaps the container.
set -e
cd "$(dirname "$0")/.."

git pull --ff-only
docker build -t manzil-api .
# Shared with the manzil-ai chatbot container, so AI_SERVICE_URL can be http://manzil-ai:8010.
docker network create manzil >/dev/null 2>&1 || true
docker rm -f manzil-api 2>/dev/null || true
docker run -d --name manzil-api --restart unless-stopped --network manzil --env-file .env -p 3001:3001 manzil-api
docker image prune -f >/dev/null

sleep 20
docker logs --tail 5 manzil-api
curl -fsS -o /dev/null -w "API answered %{http_code}\n" localhost:3001/
