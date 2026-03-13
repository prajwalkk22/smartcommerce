# SmartCommerce

AI-Enhanced Production-Ready E-Commerce Platform

## Services
| Service | Port | Description |
|---------|------|-------------|
| user-service | 3001 | Auth + profiles |
| product-service | 3002 | Catalog + images |
| order-service | 3003 | Cart + payments |
| recommendation-service | 3004 | AI suggestions |
| nginx (gateway) | 80 | API routing |

## Run locally
```bash
cd infrastructure
docker-compose up --build
```

## Health checks
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```
