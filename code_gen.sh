#!/bin/bash

# --- Helper Functions ---

wait_for_server() {
    until curl -s "$1" > /dev/null 2>&1; do sleep 1; done
}

index_python() {
    local dir=$1
    touch "$dir/__init__.py"
    echo '"""Auto-generated package imports."""' > "$dir/__init__.py"
    for f in "$dir"/*.py; do
        [ -f "$f" ] || continue
        local name=$(basename "$f" .py)
        [[ "$name" != "__init__" ]] && echo "from .$name import *" >> "$dir/__init__.py"
    done

    # Ensure subdirectories are imported in the top-level __init__.py
    for subdir in "$dir"/*/; do
        [ -d "$subdir" ] || continue
        local subname=$(basename "$subdir")
        echo "from .$subname import *" >> "$dir/__init__.py"
    done
}

index_typescript() {
    find "$1" -type d | while read -r dir; do
        local idx="$dir/index.ts"
        echo "// Auto-generated index" > "$idx"
        
        # Export files (using .js extension for ESM compatibility)
        for f in "$dir"/*.ts; do
            [ -f "$f" ] || continue
            local name=$(basename "$f" .ts)
            [[ "$name" != "index" ]] && echo "export * from './$name.js';" >> "$idx"
        done

        # Export subdirectories
        for d in "$dir"/*/; do
            [ -d "$d" ] && echo "export * from './$(basename "$d")';" >> "$idx"
        done
    done
}

# --- Main Tasks ---

gen_api() {
    cd backend && source .venv/Scripts/activate
    fastapi dev controller.py &
    local pid=$!

    echo "Waiting for server..."
    wait_for_server "http://localhost:8000/openapi.json"

    cd ../frontend
    openapi-generator-cli generate -i http://localhost:8000/openapi.json -g typescript-fetch -o ./src/base/api/api-client
    
    kill $pid && wait $pid 2>/dev/null
    cd ..
}

gen_proto() {
    echo "Generating Protos..."
    buf generate
    index_python "./backend/games/websocket_models"
    index_typescript "./frontend/src/base/api/socketModels"
}

# --- Execution ---

case "$1" in
    "-a") gen_api ;;
    "-p") gen_proto ;;
    *) gen_api; gen_proto ;;
esac

echo "Done!"