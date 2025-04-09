#!/bin/bash

KIBANA_HOST="http://localhost:5601"  # Change this
AUTH="elastic:changeme"            # Change this
TYPE="entity_watchlist"

IDS=(
  "07faacaf-68fe-4197-88a1-663967508eb1"
  "c1180f69-f8db-4a2b-90fd-118eb03817fb"
)

for ID in "${IDS[@]}"; do
  echo "Deleting $TYPE with ID $ID"
  curl -X DELETE "$KIBANA_HOST/api/saved_objects/$TYPE/$ID" \
    -H 'kbn-xsrf: true' \
    -u "$AUTH"
  echo -e "\n"
done
