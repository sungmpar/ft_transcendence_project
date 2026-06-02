all:
		docker-compose up --build

down:
		docker-compose down

re:
		docker-compose down
		docker-compose up

clean: down
		@echo "remove remaining data..."
		docker-compose down
		@echo "clean up docker..."
		chmod +x docker-cleaner.sh
		sh docker-cleaner.sh
