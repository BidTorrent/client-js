
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = function (config, complete)
{
	var loader;

	// Create the actual loading function
	loader = function ()
	{
		var container;
		var debug;
		var iframe;
		var parse;

		config = config || {};
		config.slot = config.slot || {};
		config.slot.id = config.slot.id || 'bidtorrent-ad';

		container = document.getElementById(config.slot.id);

		if (!container)
			return;

		config.slot.width = config.slot.width || container.offsetWidth;
		config.slot.height = config.slot.height || container.offsetHeight;

		config.base = config.base || 'http://bidtorrent.io';
		config.ep = config.ep || {};
		config.ep.bidders = config.ep.bidders || config.base + '/bidders.json';
		config.floor = config.floor || 0.01;
		config.passback = config.passback || '<div><img src="http://www.fundamentalfootball.com/images/PassbackLogo.gif" width="' + config.slot.width + '" height="' + config.slot.height + '" /></div>';
		config.publisher = config.publisher || document.location.href;
		config.timeout = config.timeout || 200;

		if (config.debug !== undefined)
		{
			debug = config.debug;
			parse = document.createElement('a');
			parse.href = config.base;

			if (typeof debug === 'string' && window[debug] !== undefined)
				debug = window[debug];

			addEventListener('message', function (message)
			{
				if (message.origin === parse.protocol + '//' + parse.hostname)
					debug(message.data);
			}, true);

			config.debug = true;
		}

		iframe = document.createElement('iframe');
		iframe.onload = function ()
		{
			iframe.contentWindow.postMessage(config, '*');
		};

		iframe.frameBorder = 0;
		iframe.height = config.slot.height + 'px';
		iframe.seamless = 'seamless';
		iframe.scrolling = 'no';
		iframe.width = config.slot.width + 'px';
		iframe.src = config.base + '/auction.html';

		container.appendChild(iframe);

		if (typeof complete === 'function')
			complete(config);
	};

	// Execute loader callback when page is loaded or synchronously
	if (document.readyState === 'complete' || document.readyState === 'loaded')
		loader();
	else
		document.addEventListener('DOMContentLoaded', loader, false);
};
