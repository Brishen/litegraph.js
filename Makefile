# litegraph.js - convenience wrapper around the npm scripts.
#
#   make demo     start the React demo dev server (installs deps on first run)
#   make help     list every target
#
# Dependencies are installed automatically: the node_modules targets below are
# stamped against their package.json, so `npm install` only re-runs when the
# manifest actually changes.

NPM      ?= npm
DEMO_DIR := react-demo
DEMO_PORT ?= 5173
EDITOR_PORT := 8000

# Pass extra flags through, e.g. `make demo ARGS="--host --port 3000"`
ARGS ?=

.DEFAULT_GOAL := help

.PHONY: help demo demo-build demo-preview demo-test editor install test test-lib build clean distclean

## ---------------------------------------------------------------- demo

## demo: start the React demo dev server (default http://localhost:5173)
demo: $(DEMO_DIR)/node_modules
	@echo "==> React demo on http://localhost:$(DEMO_PORT) (ctrl-c to stop)"
	cd $(DEMO_DIR) && $(NPM) run dev -- $(ARGS)

## demo-build: production build of the React demo into react-demo/dist
demo-build: $(DEMO_DIR)/node_modules
	cd $(DEMO_DIR) && $(NPM) run build

## demo-preview: serve the built React demo
demo-preview: demo-build
	cd $(DEMO_DIR) && $(NPM) run preview -- $(ARGS)

## demo-test: run the React component tests (vitest)
demo-test: $(DEMO_DIR)/node_modules
	cd $(DEMO_DIR) && $(NPM) test

## ---------------------------------------------------------------- library

## editor: serve the classic (non-React) editor on http://localhost:8000
editor: node_modules
	@echo "==> Classic editor on http://localhost:$(EDITOR_PORT) (ctrl-c to stop)"
	$(NPM) start

## build: rebuild build/litegraph.js and build/litegraph.min.js (needs java)
#
# Deliberately calls grunt directly rather than `npm run build`. That script has a
# `prebuild` hook running `rimraf build`, but grunt only regenerates litegraph.js
# and litegraph.min.js - so it would delete the committed litegraph.core.* and
# litegraph_mini.* bundles, which are produced by utils/build.sh, not by grunt.
build: node_modules
	npx grunt build

## test-lib: run the library test suite (jest)
test-lib: node_modules
	$(NPM) test

## test: run both the library and React test suites
test: test-lib demo-test

## ---------------------------------------------------------------- setup

## install: install dependencies for the library and the demo
install: node_modules $(DEMO_DIR)/node_modules

node_modules: package.json
	$(NPM) install
	@touch $@

$(DEMO_DIR)/node_modules: $(DEMO_DIR)/package.json
	cd $(DEMO_DIR) && $(NPM) install
	@touch $@

## clean: remove build output from the demo
clean:
	rm -rf $(DEMO_DIR)/dist $(DEMO_DIR)/dist-ssr coverage

## distclean: clean, and drop every installed dependency
distclean: clean
	rm -rf node_modules $(DEMO_DIR)/node_modules

## ---------------------------------------------------------------- meta

## help: list the available targets
help:
	@echo "litegraph.js"
	@echo
	@grep -E '^## [a-z-]+:' $(MAKEFILE_LIST) \
		| sed -e 's/^## //' \
		| awk -F': ' '{ printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 }'
	@echo
	@echo "  Pass flags with ARGS, e.g. make demo ARGS=\"--host --port 3000\""
