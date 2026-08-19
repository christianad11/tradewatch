PYTHON := ../project/.venv/bin/python

.PHONY: data test web build all

data:
	$(PYTHON) src/pipeline.py

test:
	$(PYTHON) -m pytest -q tests/test_pipeline.py

web:
	npm run dev

build:
	npm run build

all: data test build

