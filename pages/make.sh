#!/bin/bash
BASEDIR=$(dirname $0)
cd $BASEDIR
JS="/tmp/$$.js"

lessc make.less > make.gen.css &&
browserify -o ./make.gen.js make.js &&
cat > /tmp/make.data <<EOF
{
  "state": {
    "apiUrl": "$API_URL",
    "googleTrackingCode": "$GOOGLE_TRACKING_CODE"
  }
}
EOF
jade make.jade -O /tmp/make.data -o /tmp &&
s3cmd -c $S3_CFG --acl-public --add-header="Cache-control:max-age=3600" -m text/html put /tmp/make.html $S3_PATH/index.html
rm make.gen.css &&
rm make.gen.js 
