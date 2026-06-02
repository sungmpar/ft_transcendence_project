#!/bin/bash

images=$(docker images -q)

if [ -n "$images" ]; then
		docker rmi images $images
		echo "Images removed"
fi

echo " - Cleaning Images Done - "

danglings=$(docker volume ls -qf dangling=true)

if [ -n "$danglings" ]; then
		docker volume rm $danglings
		echo "Dangling volumes removed"
		lsof -t -i tcp:5432 | xargs kill -9
		echo "Postgres killed"
fi

echo " - Cleaning Volumes Done - "
