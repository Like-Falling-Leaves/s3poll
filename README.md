# A library for dealing with polls with data stored on S3

## Components

The library consists of a few components

* A nodejs library (lib/) that has routines to create, delete and vote on polls.
* An express server (server/) that is heroku-ready which implements the API used by the browser components.
* A couple of web pages (pages/) driven by JADE templates for rendering the poll and its results.  These are FB- and Twitter- friendly.
* A browser component (browser/) used by the pages to access the server API for polling.
* A command line utility (bin/) that helps drive some of the setup work needed.