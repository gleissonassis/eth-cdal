TAG ?= dev##@variables The image version
VERSION ?= master##@variables Version of the source code
NAMESPACE ?= gleissonassis##@variables Sets the namespace in which the image belongs
IMAGE ?= eth-cdal##@variables Image name
CONTAINER ?= eth-cdal##@variables Container name
DB_SERVER ?= localhost##@variables Database to connect
DB_NAME ?= eth-services##@variables Schema name
PORT ?= 4000##@variables Default API port
SECRET_KEY ?= secret##@variables Secret key for JWT
MIN_CONFIRMATIONS ?= 3##@variables Minimal confirmations in blockchain
MIN_ADDRESS_POOL_SIZE ?= 100##@variables Pool size of addresses
NOTIFICATION_API_ADDRESS ?= http://localhost:3004/v1/wallets/${symbol}/notifications##@variables Backend API URL route notifications
DAEMON_GAS_LIMIT ?= 4712388##@variables Gas limit to use
DAEMON_BASE_URL ?= http://localhost:8545##@variables Coin RPC Port
DAEMON_DEFAULT_SYMBPL ?= ETH##@variables Default Symbol ETH or ETC
DAEMON_MAIN_ADDRESS ?= 0x6025961e3F43AeB967f28A0aD88E46860b85def4##@variables Default main address for transfers
DAEMON_ER20_TRANSFER_GAST_LIMIT ?= 57381##@variables Gas limit for transfers

HELP = %help; \
       sub trim { my $$s = shift; $$s =~ s/^\s+|\s+$$//g; return $$s }; \
       while(<>) { \
         push @{$$help{trim($$4) // 'targets'}}, \
           [trim($$1), trim($$5),defined($$3) && length(trim($$3)) ? " (default: " . trim($$3) . ")" : ""] \
             if /^([\w-]+)[\s\W]*((?:=(.*))|:.*)\#\#(?:@(\w+))?\s(.*)$$/; \
       } \
       print "usage: make [-e variable, ...] [target]\n\n"; \
       for (keys %help) { \
         print "$$_:\n"; \
         printf "  %s%s%s%s\n", $$_->[0], " " x (20 - length $$_->[0]), $$_->[1], $$_->[2] \
           for @{$$help{$$_}}; \
         print "\n"; \
       }

PORT = -p $(PORT):$(PORT)
ENV = -e DB_SERVER=$(DB_SERVER) \
      -e DB_NAME=$(DB_NAME) \
      -e SECRET_KEY=$(SECRET_KEY) \
      -e MIN_CONFIRMATIONS=$(MIN_CONFIRMATIONS) \
      -e MIN_ADDRESS_POOL_SIZE=$(MIN_ADDRESS_POOL_SIZE) \
      -e NOTIFICATION_API_ADDRESS=$(NOTIFICATION_API_ADDRESS) \
      -e DAEMON_GAS_LIMIT=$(DAEMON_GAS_LIMIT) \
      -e DAEMON_BASE_URL=$(DAEMON_BASE_URL) \
      -e DAEMON_DEFAULT_SYMBPL=$(DAEMON_DEFAULT_SYMBPL) \
      -e DAEMON_MAIN_ADDRESS=$(DAEMON_MAIN_ADDRESS) \
      -e DAEMON_ER20_TRANSFER_GAST_LIMIT=$(DAEMON_ER20_TRANSFER_GAST_LIMIT)

VOLUME =

.PHONY: help build push shell start stop start-dev stop-dev

help:
	@perl -e '$(HELP)' $(MAKEFILE_LIST)

build: ## Build a new docker image
	docker build --no-cache --build-arg VERSION=$(VERSION) -t $(NAMESPACE)/$(IMAGE):$(TAG) .

push: ## Push the image into registry
	docker push $(NAMESPACE)/$(IMAGE):$(TAG)

shell: ## Start the image with interactive shell - /bin/sh
	docker run --rm --name $(CONTAINER) -i -t $(PORT) $(VOLUME) $(ENV) $(NAMESPACE)/$(IMAGE):$(TAG) /bin/sh

start: ## Start a new container
	docker run -d --name $(CONTAINER) $(PORT) $(VOLUME) $(ENV) $(NAMESPACE)/$(IMAGE):$(TAG)

stop: ## Stop and remove the container
	docker stop $(CONTAINER)
	docker rm $(CONTAINER)

start-dev: ## Start the developer environment - docker-compose
	docker-compose -p cdal up -d

stop-dev: ## Stop the developer environmnet - docker-compose
	docker-compose -p cdal down
