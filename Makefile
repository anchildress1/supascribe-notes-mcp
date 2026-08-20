.PHONY: install lint format test test-coverage secrets-scan ai-checks build clean dev deploy

dev:
	npm run dev

install:
	npm install
	./node_modules/.bin/lefthook install

lint:
	npm run lint

format:
	npm run format

test:
	npm run test

test-coverage:
	npm run test:coverage

secrets-scan:
	./node_modules/.bin/secretlint "**/*"

ai-checks: format lint build test-coverage secrets-scan
	@echo "✅ All checks passed"

build:
	npm run build

clean:
	rm -rf dist coverage

deploy:
	./deploy.sh
