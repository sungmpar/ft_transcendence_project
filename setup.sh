#!/bin/sh
HOST_IP=$(ipconfig getifaddr en0)
if [[ $1 == "1" ]]; then
    sed -i '' "s/$HOST_IP/localhost/g" ./backend/.env
    sed -i '' "s/$HOST_IP/localhost/g" ./frontend/.env
    echo "ip to localhost . . . . ."
else
    sed -i '' "s/localhost/$HOST_IP/g" ./backend/.env
    sed -i '' "s/localhost/$HOST_IP/g" ./frontend/.env
    echo "localhost to ip . . . . ."
fi
# usage
# sh setup.sh
# localhost -> [192.***.***.***]
# sh setup.sh 1
# [192.***.***.***] -> localhost
