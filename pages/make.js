var querystring = require('querystring');
var s3poll = require('../browser/s3poll');
var hammer = require('./vendor/hammer');

$(function () {
  s3poll.configure($, state.apiUrl);
  $('form').submit(onSubmit);
  initializeShowBox();
  $('button[name=get-started]').click(function () {
    $('form').show();
    $('.demos').remove();
    $('html, body').animate({scrollTop: $('form').offset().top});
  });
  $('button[name=demos]').click(showDemos);
});

function onSubmit(ee) {
  ee.preventDefault();
  var state = {choices: []}, seen = {};
  var choice, description;
  var aborted = false;
  $('input').each(function () {
    var name = $(this).attr('name');
    var val  = $(this).val();
    if (name == 'title') state.title = state.pageTitle = val;
    else if (name == 'description') state.description = val;
    else if (name[0] == 'l') {
        description = val || choice;
      choice = choice || description;
      if (choice && description) state.choices.push({choice: choice, description: description});
      choice = description = null;
    } else if (seen[val]) {
      aborted = true;
      return abort('You have used "' + val + '" twice as your choice.  Choices must be unique');
    } else if (val) choice = seen[val] = val;
  });
  if (aborted) return;
  if (!state.title) return abort('Polls need a title.  Please specify a title.');
  if (!state.description) return abort('Polls need to have a question.  Please provide a question.');
  $('form').off().submit(function (ee) { return ee.preventDefault(); })
    .find('button').empty().append(
      $('<i>', {'class': 'fa fa-spinner fa-spin'}),
      $('<span>', {text: ' Please wait..'})
    );

  s3poll.create(state, 'simple', function (err, data) {
    $('form').off().submit(onSubmit).find('button').empty().text('CREATE');
    if (err || !data.success) return abort('Sorry, an error occured. Try again.');
    $('.contents').empty().append(
      $('<p>', {text:'Successfully created the poll. Click on the button to see it and share it.'}),
      $('<div>', {'class': 'center'}).append(
        $('<button>', {type: 'submit', name: 'preview', text: 'PREVIEW POLL'}).click(function () {
          window.location = data.url + '?share=1';
        })
      )
    );
  });
}

function abort(message) {
  var overlay = $('<div>', {'class': 'overlay'}).append(
    $('<div>', {'class': 'block'}).append(
      $('<div>', {'class': 'whitecell center', text: message})
    )
  ).appendTo($('body')).on('click touch scroll tap', function () {
    overlay.fadeOut(function () { overlay.remove(); });
  });
  return false;
}

function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
    if (immediate && !timeout) func.apply(context, args);
  };
}

function initializeShowBox() {
  var hammertime = new hammer($('div.showbox-viewport')[0], {});
  var deltaX = 0;
  var fixup = debounce(fixupIfNeeded, 100);
  var count = $('.showbox').length;
  var autoSwipeLeft = swipeLeft;
  var dots = $('<div>', {'class': 'dots'}).append(
    $('.showbox').map(function () { return $('<i>', {'class': 'fa fa-circle'})[0]; })
  ).appendTo($('div.showbox-viewport')).click(onClickedDot);

  hammertime.on('swipe', swipe).on('pan', pan).on('swipe pan', function () { autoSwipeLeft = null; });
  $(window).on('click touch tap scroll resize', function () { autoSwipeLeft = null; });

  activateDot();


  if ($('.showbox-viewport').is(':visible')) setTimeout(autoSwipeLeft, 7000);
  function swipeLeft() { 
    if (!autoSwipeLeft) return; 
    swipe({direction: hammer.DIRECTION_LEFT}); setTimeout(autoSwipeLeft, 5000); 
  }

  function swipe(ev) {
    if ($('.showbox').first().is(':animated')) return;
    var width = $('.showbox').first().outerWidth();
    var margin = parseInt($('.showbox').first().css('margin-left'));
    if (deltaX) margin -= deltaX;
    if (ev.direction == hammer.DIRECTION_LEFT) margin -= width; else margin += width;
    deltaX = 0;
    if (margin > 0) margin = 0;
    if (margin < - width * (count - 1)) margin = - width * (count - 1);
    $('.showbox').first().animate({marginLeft: (margin * 100 /width) + '%'}, activateDot);
  }

  function pan(ev) {
    if ($('.showbox').first().is(':animated')) return;
    var margin = parseInt($('.showbox').first().css('margin-left'));
    margin += (ev.deltaX - deltaX);
    deltaX = ev.deltaX;
    $('.showbox').first().css({marginLeft: margin});
    fixup();
    autoSwipeLeft = null;
  }

  function fixupIfNeeded() {
    deltaX = 0;
    if ($('.showbox').first().is(':animated')) return;
    var width = $('.showbox').first().outerWidth();
    var margin = parseInt($('.showbox').first().css('margin-left'))
    var sign = (margin > 0) ? 1 : -1;
    margin = sign * Math.round( sign * margin / width) * width;
    if (margin > 0) margin = 0;
    if (margin < - width * (count - 1)) margin = - width * (count - 1);
    $('.showbox').first().animate({marginLeft: (margin * 100 /width) + '%'}, activateDot);
  }

  function onClickedDot(ee) {
    var target = $(ee.target);
    if (!target.is('.fa-circle')) return;
    var index = target.index();
    $('.showbox').first().animate({marginLeft: -(index*100) + '%'});
    target.parent().find('.fa-circle').removeClass('active');
    target.addClass('active');
  }

  function activateDot() {
    var margin = -parseInt($('.showbox').first().css('margin-left'))
    var width = $('.showbox').first().outerWidth();
    var index = margin/width;
    $(dots.find('.fa-circle').removeClass('active').get(index)).addClass('active');
  }
}

var demoUrls = [
  "/polls/p/iMfkvrke.llq8IWmbHSldA--?share=1",
  "/polls/p/JUoVOu_VD9UuBpJus6DY2g--?share=1"
];

function showDemos() {
  $('ul').hide();
  $('.examples').hide();
  $('form').hide();
  $('.get-started').show();
  $('body').append(
    $('<div>', {'class': 'demos'})
      .append($('<div>', {'class': 'description', text: 'Check out the following demos!'}))
      .append(getIframes())
  );
  $('html, body').animate({scrollTop: $('.demos').offset().top});

  function getIframes() {
    var ret = [];
    for (var kk = 0; kk < demoUrls.length; kk ++) ret.push(
      $('<iframe>', {src: demoUrls[kk]}).load(resizeIframe)
    );
    return ret;
  }
}

function resizeIframe() {
  $(this).css({height: this.contentWindow.document.body.scrollHeight + 'px'});
}
