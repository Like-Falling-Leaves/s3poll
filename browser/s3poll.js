(function (self) {
  var store = (function () { try { return window.localStorage; }catch (e) {}; })();
  if ( typeof(module) != 'undefined') module.exports = getExports();
  else if (typeof(window) != 'undefined') window.s3poll = getExports();
  else self.s3poll = getExports();

  function getExports() { 
    return {
      vote: vote, getSummary: getSummary, create: create,
      configure: configure, getLastVote: getLastVote, config: {}
    }; 
  }
  function configure($, apiUrl, topic) { this.config.apiUrl = apiUrl; this.config.topic = topic; this.config.$ = $; }
  function getLastVote(info, done) {
    info = {client: info.client, topic: info.topic || this.config.topic};
    fixClient(info);
    return store && store.getItem([info.client, info.topic].join(','));
  }
  function vote(info, done) {
    info = {client: info.client, topic: info.topic || this.config.topic, choice: info.choice};
    fixClient(info);
    var params = {type: 'POST', contentType: 'application/json', data: JSON.stringify(info)};
    this.config.$.ajax((this.config.apiUrl || '') + '/vote', params).done(voted).fail(done);
    function voted(data) {
      if (!data.success) return done('error', data);
      if (store && info.choice) store.setItem([info.client, info.topic].join(','), info.choice);
      return done(null, data);
    }
  }
  function getSummary(info, done) {
    info = {topic: info && info.topic || this.config.topic};
    var params = {type: 'POST', contentType: 'application/json', data: JSON.stringify(info)};
    this.config.$.ajax((this.config.apiUrl || '') + '/getSummary', params)
      .done(function (data) { return done(data.success ? null : 'error', data); }).fail(done);
  }
  function create(state, template, done) {
    var params = {type: 'POST', contentType: 'application/json', data: JSON.stringify({state: state, template: template})};
    this.config.$.ajax((this.config.apiUrl || '') + '/create', params)
      .done(function (data) { return done(data.success ? null : 'error', data); }).fail(done);
  }
  function fixClient(info) { 
    info.client = info.client || (store && store.getItem('client')) || guid();
    if (info.client && store) store.setItem('client', info.client);
  }

  var lut = []; for (var i=0; i<256; i++) { lut[i] = (i<16?'0':'')+(i).toString(16); }
  function guid()
  {
    var d0 = Math.random()*0xffffffff|0;
    var d1 = Math.random()*0xffffffff|0;
    var d2 = Math.random()*0xffffffff|0;
    var d3 = Math.random()*0xffffffff|0;
    return lut[d0&0xff]+lut[d0>>8&0xff]+lut[d0>>16&0xff]+lut[d0>>24&0xff]+'-'+
      lut[d1&0xff]+lut[d1>>8&0xff]+'-'+lut[d1>>16&0x0f|0x40]+lut[d1>>24&0xff]+'-'+
      lut[d2&0x3f|0x80]+lut[d2>>8&0xff]+'-'+lut[d2>>16&0xff]+lut[d2>>24&0xff]+
      lut[d3&0xff]+lut[d3>>8&0xff]+lut[d3>>16&0xff]+lut[d3>>24&0xff];
  }
})(this);
