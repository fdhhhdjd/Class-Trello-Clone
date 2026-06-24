.PHONY: dev down prod migrate seed health logs

dev:
	docker compose up -d --build

down:
	docker compose down

prod:
	docker compose -f docker-compose.yml up -d --build

migrate:
	docker compose exec api npx prisma migrate deploy

seed:
	docker compose exec api npm run seed

health:
	@echo "api:    " && curl -fsS http://localhost:4000/health && echo
	@echo "user:   " && curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost
	@echo "admin:  " && curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:8081
	@echo "landing:" && curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:3000

logs:
	docker compose logs -f
