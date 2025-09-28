SHELL := /bin/bash

.PHONY: dev backend frontend

dev:
	@bash scripts/dev.sh

backend:
	@cd Backend && ./.venv/bin/python manage.py runserver 0.0.0.0:8000

frontend:
	@cd Frontend && ./node_modules/.bin/ng serve --host 0.0.0.0 --port 4200

