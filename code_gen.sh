#!/bin/bash

# Define the tasks as functions
gen_api() {
    cd backend
    source .venv/Scripts/activate
    fastapi dev controller.py &
    SERVER_PID=$!

    echo "Waiting for server..."
    until curl -s http://localhost:8000/openapi.json > /dev/null 2>&1; do sleep 1; done

    cd ../frontend
    openapi-generator-cli generate -i http://localhost:8000/openapi.json -g typescript-fetch -o ./src/base/api-client
    
    kill $SERVER_PID
    wait $SERVER_PID 2>/dev/null
    cd ..
}

gen_proto() {
    echo "Generating Protos..."
    buf generate
}

# --- Flag Logic ---
case "$1" in
    "-a")
        gen_api
        ;;
    "-p")
        gen_proto
        ;;
    *)
        # Default: Run both if no flag or unknown flag is passed
        gen_api
        gen_proto
        ;;
esac

echo "Done!"