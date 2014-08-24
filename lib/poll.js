var _ = require('lazy.js');
var jade = require('jade');
var less = require('less');
var fs = require('fs');
var browserify = require('browserify');
var jade = require('jade');
var s3 = require('./s3');
var child_process = require('child_process');
var crypto = require('crypto');

module.exports.create = createPoll;
module.exports.get = getPollInfo;
module.exports.update = updatePoll;

function createPoll(state, template, done) {
  var topic = crypto.randomBytes(16).toString('base64').replace(/[+]/g, '.').replace(/\//g, '_').replace(/=/g, '-');
  if (typeof(state.title) != 'string') return done('Require title');
  if (typeof(state.pageTitle) != 'string') return done ('Request page title');
  if (typeof(state.description) != 'string') return done('Require description');
  var choices = state.choices;
  if (!choices || !choices.length) return done('Request choices');
  state = {
    template: template.split('/').slice(-1)[0],
    topic: state.topic,
    title: state.title,
    pageTitle: state.pageTitle,
    description: state.description,
    apiUrl: process.env.API_URL,
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleTrackingCode: process.env.GOOGLE_TRACKING_CODE,
    choices: []
  };
  var error = false;
  _(choices).each(function (choice) {
    if (typeof(choice.choice) != 'string' || typeof(choice.description) != 'string') {
      error = true;
      return done('Expect choices to have short form and long form (choice/description) values.');
    }
    state.choices.push({choice: choice.choice, description: choice.description});
  });
  return processTemplate({topic: topic}, state, template, done);
}

function getPollInfo(topic, done) {
  s3.JSON.get({path: 'p/' + topic + '.json'}, done);
}

function updatePoll(topic, done) {
  var state;
  getPollInfo(topic, function (err, _state) {
    if (err) return done(err);
    state = _state;
    s3.getSummary({topic: topic}, onHaveSummary);
  });
  function onHaveSummary(err, ss) {
    if (err) return done(err);
    var template = __dirname + '/../pages/' + (state.template || 'simple');
    state.summary = {counts: ss.counts || []};
    processTemplate({topic: topic}, state, template, function (err) {
      if (err) return done(err);
      return done(null, ss);
    });
  }
}

function processTemplate(info, state, template, done) {
  var imgPath = process.env.S3_WEBSITE + '/' + (info.prefix || process.env.S3_PREFIX || 'polls/') + 'p/' + info.topic + '.jpeg';
  var htmlPath = imgPath.slice(0, -5) + "?summarize=1&alert=1";
  var parser = new (less.Parser) ({filename: template + '.less'});
  var lessCode = '';
  try { lessCode = fs.readFileSync(template + '.less').toString(); } catch (ee) {}
  parser.parse(lessCode, function (err, tree) {
    if (err) return done(err);
    fs.writeFileSync(template + '.gen.css', tree.toCSS({compress: true}));
    compileJS();
  });
  function compileJS() {
    var b = browserify();
    b.add(template + '.js');
    var next = function (err) { return err ? done(err) : compileJade(); };
    b.bundle().on('error', next)
      .pipe(fs.createWriteStream(template + '.gen.js').on('finish', next).on('error', next));
  }
  function compileJade() {
    state = state || {};
    state.topic = info.topic;
    state.title = state.title || state.description;
    state.pageTitle = state.pageTitle || process.env.PAGE_TITLE;
    state.description =  state.description || state.title;
    state.meta = [
      {name: 'description', content: state.description},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {property: 'twitter:card', content: 'photo'},
      {name:"twitter:creator", content:process.env.TWITTER_CARD_HANDLE},
      {name:"twitter:domain", content:process.env.TWITTER_CARD_DOMAIN},
      {property:"twitter:title", content:state.title},
      {property:"twitter:description", content: state.description},
      {property:"twitter:image", content:imgPath + '?_=' + (new Date()).getTime()},
      {property:"og:title", content:state.title},
      {property:"og:type", content:"article"},
      {property:"og:image", content:imgPath + '?_=' + (new Date()).getTime()}
    ];
    state.apiUrl = state.apiUrl || process.env.API_URL;
    try {
      var html = jade.renderFile(template + '.jade', {
        filename: template + '.jade',
        pretty: false,
        debug: false,
        compileDebug: false,
        state: state || {}
      })
    } catch (ee) { return done(err); }
    info = _({}).assign(info).assign({path: 'p/' + info.topic}).value();
    s3.HTML.save(info, html, generateScreenshot);
  }
  function generateScreenshot(err) {
    if (err) return done(err);
    var tmpFile = '/tmp/' + (new Date().getTime()) + '.jpeg';
    var args = [__dirname + '/rasterize.js', htmlPath, tmpFile, '500*500']
    console.log('Procesing', args.join(' '));
    var proc = child_process.spawn(process.env.PHANTOM_JS, args);
    proc.on('close', function (code) {
      if (code) return done('Screenshot failed with: ' + code);
      info = _({}).assign(info).assign({path: 'p/' + info.topic + '.jpeg'}).value();
      s3.JPEG.save(info, tmpFile, saveState);
    });
  }

  function saveState(err) {
    if (err) return done(err);
    s3.JSON.save({path: 'p/' + info.topic + '.json'}, state, function (err) {
      if (err) return done(err);
      return done(null, process.env.CDN_WEBSITE + '/' + (info.prefix || process.env.S3_PREFIX || 'polls/') + 'p/' + info.topic);
    });
  }
}

createPoll({
  title: 'Football or Soccer?',
  pageTitle: 'CHOOSE',
  description: 'Which do you prefer, Football or Soccer?',
  choices: [
    {choice: 'football', description: 'I prefer Football'},
    {choice: 'soccer', description: 'I prefers Soccer'}
  ]
}, __dirname + '/../pages/simple', function (err, url) {
  console.log('Error', err, url);
});

if (0) updatePoll('CfoP3tXjsfmjZ.A3GF3DSA--',  __dirname + '/../pages/simple', function (err, ss) {
  console.log('Error', err, JSON.stringify(ss));
});
