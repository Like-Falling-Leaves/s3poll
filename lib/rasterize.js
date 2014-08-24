var page = require('webpage').create();
var system = require('system');
var address, output, size;

if ((system.args.length < 3) || (system.args.length > 4)) {
  console.log('Usage: rasterize.js URL filename [page-width*page-height]');
  phantom.exit(1);
}

address = system.args[1];
output = system.args[2];
page.viewportSize = {width: 600, height: 600};

if (system.args.length > 3) {
  size = system.args[3].split('*');
  page.viewportSize = {width: size[0], height: size[1]};
}

page.zoomFactor = 2;
page.onAlert = renderPage;
page.open(address, function (status) {
  if (status == 'success') return window.setTimeout(renderPage, 5000);
  console.log('Unable to load the address!');
  return phantom.exit(1);
});

function renderPage() { page.render(output); phantom.exit(0); }

