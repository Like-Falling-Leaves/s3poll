var _ = require('lazy.js');
var fs = require('fs');
var AWS = require('aws-sdk');

module.exports = {
  vote: vote,
  getVotes: getVotes,
  getSummary: getSummary,
  JSON: {
    save: saveJSON,
    get: getJSON
  },
  HTML: {save: saveHTML},
  JPEG: {save: saveJPEG}
};


function getConfig(info) {
  return _({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.S3_REGION || 'us-west-2',
    bucket: process.env.S3_BUCKET,
    prefix: process.env.S3_PREFIX || 'polls/'
  }).assign(info).value();
}

function vote(info, done) {
  var required = {client: 'string', topic: 'string', choice: 'string'};
  for (var key in required) {
    if (typeof (info[key]) != required[key]) return done('Missing or invalid <' + key +'>');
  }

  var path = _([info.topic, info.choice, info.client]).map(encodeURIComponent).value().join('/');
  saveJSON(_({}).assign(info).assign({path: path}).value(), {}, done);
}

function getVotes(info, done) {
  var cfg = getConfig(info);
  var path = _([info.topic, info.choice]).compact().map(encodeURIComponent).value().join('/');
  if (path) path += '/';
  var s3 = new AWS.S3({accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region});
  var params = {Bucket: cfg.bucket, Prefix: cfg.prefix + path};
  var votes = [];
  var fields = ['topic', 'choice', 'client', 'lastModified'];
  fetchVotes();

  function fetchVotes() {
    s3.listObjects(params, function (err, data) {
      if (err) return done(err, votes);
      _(data.Contents).each(function (fileInfo) {
        var parts = _(fileInfo.Key.replace(cfg.prefix, '').split('/')).map(decodeURIComponent).value();
        votes.push(_(fields).zip(parts.concat([new Date(fileInfo.LastModified).getTime()])).toObject());
        params.Marker = fileInfo.Key;
      });
      if (!data.IsTruncated) return done(null, votes);
      return fetchVotes();
    });
  }
}

function getSummary(info, done) {
  getVotes(info, function (err, votes) {
    if (err) return done(err);
    var results = {};
    _(votes).sortBy(function (vv) { return vv.lastModified; })
      .each(function (vote) {
        results[vote.topic] = results[vote.topic] || {};
        results[vote.topic][vote.client] = vote.choice;
      });
    var summary = {votes: {}, counts: {}};
    for (var topic in results) {
      summary.votes[topic] = {};
      summary.counts[topic] = {};
      for (var client in results[topic]) {
        var choice = results[topic][client];
        summary.votes[topic][choice] = summary.votes[topic][choice] || [];
        summary.votes[topic][choice].push(client);
        summary.counts[topic][choice] = (summary.counts[topic][choice] || 0) + 1;
      }
    }
    return done(null, summary);
  });
}

function saveJPEG(info, jpeg, done) {
  var cfg = getConfig(info);
  var s3 = new AWS.S3({accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region});
  var params = {Bucket: cfg.bucket, Key: cfg.prefix + cfg.path, ContentType: 'image/jpeg', Body: fs.readFileSync(jpeg)};
  params.ACL = 'public-read';
  params.CacheControl = 'max-age=3600';
  s3.putObject(params, done);
}

function saveHTML(info, html, done) {
  var cfg = getConfig(info);
  var s3 = new AWS.S3({accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region});
  var params = {Bucket: cfg.bucket, Key: cfg.prefix + cfg.path, ContentType: 'text/html', Body: html};
  params.ACL = 'public-read';
  params.CacheControl = 'max-age=3600';
  s3.putObject(params, done);
}

function saveJSON(info, obj, done) {
  var cfg = getConfig(info);
  var s3 = new AWS.S3({accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region});
  var params = {Bucket: cfg.bucket, Key: cfg.prefix + cfg.path, ContentType: 'application/json', Body: JSON.stringify(obj)};
  s3.putObject(params, done);
}

function getJSON(info, done) {
  var cfg = getConfig(info);
  var s3 = new AWS.S3({accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region});
  var params = {Bucket: cfg.bucket, Key: cfg.prefix + cfg.path};
  var data = '';
  s3.getObject(params, function (err, data) {
    if (err) return done(err);
    try {
      return done(null, JSON.parse(data.Body.toString()));
    } catch (e) {
      return done(e);
    }
  });
}


function main() {
  var args = require('minimist')(process.argv.slice(2));
  if (args.vote) return vote(args, function (err) {
    if (!err) process.exit(0);
    console.error('Error:', err);
    process.exit(1);
  });
  if (args.getVotes) return getVotes(args, function (err, votes) {
    _(votes).each(function (vv) { console.log(JSON.stringify(vv)); });
    if (!err) process.exit(0);
    console.error('Error:', err);
    process.exit(1);
  });
  if (args.getSummary) return getSummary(args, function (err, summary) {
    console.log(JSON.stringify(summary ||{}, null, 2));
    if (!err) process.exit(0);
    console.error('Error:', err);
    process.exit(1);
  });
  console.error('Error:', 'Unknown command');
  process.exit(1);
}


if (require.main === module) main();
