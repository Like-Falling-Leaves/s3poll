var querystring = require('querystring');
var s3poll = require('../browser/s3poll');
var allClasses = 'vote voting summarizing summarized';
var link, fbLink, twLink, twShare = 'https://mobile.twitter.com/compose/tweet?status=';
$(function () {
  link = location.origin + location.pathname + '?_=' + (new Date()).getTime();
  fbLink = 'https://www.facebook.com/sharer/sharer.php?u='+ encodeURIComponent(link);
  twLink = twShare + encodeURIComponent(link);

  $('a.fa.fa-facebook').attr({href: fbLink, target: '_blank'});
  $('a.fa.fa-twitter').attr({href: twLink, target: '_blank'});
  s3poll.configure($, state.apiUrl, state.topic);
  $('li.choice').on('click.simple', onClicked);
  resetVote(s3poll.getLastVote({}));
  var query = querystring.parse((window.location.search || '').slice(1));
  if (query.alert) $('.share, .make').remove();
  if (query.share) $('.share').removeClass('hidden');
  if (query.summarize) return summarize(null, function () { return query.alert && alert('alert'); });
  if (query.alert) return alert('alert');
  $('.fa.fa-envelope-o').click(onLinkClicked);
  if (!query.alert) shortenTwitterLinks();
});

function shortenTwitterLinks() {
  if (!state.googleApiKey) return;
  var params = { contentType: 'application/json', type: 'POST', data: JSON.stringify({longUrl: link})};
  $.ajax("https://www.googleapis.com/urlshortener/v1/url?key=" + encodeURIComponent(state.googleApiKey), params)
    .done(function (data) { $('a.fa.fa-twitter').attr({href: twShare + encodeURIComponent(data.id)}); });
}

function onLinkClicked() {
  var share = $(this).closest('.share');
  var input = $('<input>', {type: 'text'}).appendTo(share).val(link).blur(function () { input.remove();});
  try {
    input[0].selectionStart = 0;
    input[0].selectionEnd = input.val().length;
  } catch (e) {};
  input.focus();
}

function resetVote(lastVote) {
  $('body').removeClass(allClasses).addClass('vote');
  $('li.choice').each(function () {
    if ($(this).attr('data-choice') == lastVote) voted($(this));
    else $(this).removeClass('checked');
  });
}

function voted(elt) { elt.addClass('checked'); summarize(); }
function summarize(summary, done) {
  $('.share').removeClass('hidden');
  $('body').removeClass(allClasses).addClass('summarizing');
  $('.header').text('Summarizing Results');
  renderSummary((summary || state.summary || {counts: []}).counts[state.topic] || {});
  if (summary) {
    $('.header').text('Results');
    $('body').removeClass(allClasses).addClass('summarized');
    return done && done();
  }

  s3poll.getSummary({}, function (err, summary) {
    if (err) return done && done(err);
    $('.header').text('Results');
    renderSummary(summary && (summary.summary || {counts: []}).counts[state.topic] || {});
    $('body').removeClass(allClasses).addClass('summarized');
    return done && done();
  });
}

function renderSummary(topicCounts) {
  var total = 0;
  for (var kk = 0; kk < state.choices.length; kk ++) {
    total += topicCounts && topicCounts[state.choices[kk].choice] || 0;
  }
  $('tr.choice').each(function () {
    if (total === 0) {
      $(this).find('.meter').css({width: 0});
      return $(this).find('td.val').text('-');
    }
    var thisChoice = $(this).attr('data-choice');
    var thisCount = topicCounts && topicCounts[thisChoice] || 0;
    var percentage = thisCount * 100 / total;
    $(this).find('.meter').css({width: percentage + '%'});
    $(this).find('td.val').text(Math.round(percentage) + '%');
  });
}

function onClicked(ee) {
  var li = $(ee.target).closest('li.choice');
  var lastVote = s3poll.getLastVote({});
  if (li.is('.checked')) return;
  $('.choices li').removeClass('checked');
  li.addClass('checked');
  var choice = li.attr('data-choice');
  $('body').removeClass(allClasses).addClass('voting');
  s3poll.vote({choice: choice}, function (err, summary) {
    if (err) resetVote(lastVote);
    summarize(summary && summary.summary);
  });
}
