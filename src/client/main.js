
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = (function ()
{
	var client;
	var probes;
	var url;

	// BidTorrent JavaScript client
	client = function (init)
	{
		var loader;

		// Ensure required JavaScript features are supported
		if ((typeof postMessage === 'undefined') ||
		    (typeof XMLHttpRequest === 'undefined') ||
		    (!('withCredentials' in new XMLHttpRequest()) && (typeof XDomainRequest === 'undefined')))
			return;

		// Create the actual loading function
		loader = function ()
		{
			var debug;
			var element;
			var iframe;
			var imp;
			var listener;
			var parse;
			var slot;

			// Populate initialization object with missing default value
			init = init || {};

			if (init.config === undefined)
			{
				console.error('[BidTorrent] no configuration object specified');
				return;
			}

			init.auction = url(init.auction || 'http://bidtorrent.io/auction.html');
			init.bidders = url(init.bidders || 'http://www.bidtorrent.io/api/bidders');
			init.configUrl = init.configUrl ? url(init.configUrl) : undefined;
			init.passback = url(init.passback);
			init.statUrl = url(init.statUrl || 'http://stats.bidtorrent.io/imp.php');

			if (!init.config.imp || init.config.imp.length === 0)
			{
				console.error('[BidTorrent] at least one impression has to be specified');
				return;
			}

			for (var i = 0; i < init.config.imp.length; ++i)
			{
				imp = init.config.imp[i];

				if (!imp.id || typeof imp.id !== 'string')
				{
					console.error('[BidTorrent] impression #' + i + ' is invalid');
					return;
				}

				element = document.getElementById(imp.id);

				if (!element)
				{
					console.error('[BidTorrent] no DOM element found for id #' + imp.id);
					return;
				}

				imp.banner = imp.banner || {};
				imp.banner.h = imp.banner.h || element.offsetHeight;
				imp.banner.w = imp.banner.w || element.offsetWidth;

				// Create and append auction iframe
				iframe = document.createElement('iframe');
				iframe.onload = (function (channel)
				{
					return function ()
					{
						iframe.contentWindow.postMessage({
							bidders:	init.bidders,
							channel:	channel,
							config:		init.config,
							configUrl:	init.configUrl,
							debug:		init.debug,
							statUrl: 	init.statUrl
						}, '*');
					};
				})(i);

				iframe.frameBorder = 0;
				iframe.height = imp.banner.h + 'px';
				iframe.scrolling = 'no';
				iframe.seamless = 'seamless';
				iframe.width = imp.banner.w + 'px';
				iframe.src = init.auction;

				element.appendChild(iframe);

				// Create and append debug mode iframe
				if (init.debug)
				{
					debug = document.createElement('div');
					debug.className = 'bidtorrent-debug';
					debug.style.width = imp.banner.w + 'px';

					element.appendChild(debug);

					parse = document.createElement('a');
					parse.href = init.auction;
				}
				else
					debug = undefined;

				// Connect to messages from auction component
				listener = function (channel, debug)
				{
					return function (message)
					{
						if (message.origin !== parse.protocol + '//' + parse.hostname || message.data.channel !== channel)
							return;

						switch (message.data.type)
						{
							case 'alert':
								if (debug !== undefined)
									console.error('[BidTorrent] ' + message.data.message);

								break;

							case 'debug':
								if (debug !== undefined)
								{
									for (var i = 0; i < probes.length; ++i)
										probes[i](debug, message.data.auction, message.data.event, message.data.data);
								}

								break;
						}
					};
				};

				addEventListener('message', listener(i, debug), true);
			}
		};

		// Execute loader callback when page is loaded or synchronously
		if (document.readyState === 'complete' || document.readyState === 'loaded')
			loader();
		else
			document.addEventListener('DOMContentLoaded', loader, false);
	};

	// Parse relative into absolute URL
	url = function (relative)
	{
		var parse = document.createElement('a');

		parse.href = relative;

		return parse.href;
	};

	// BidTorrent JavaScript debug handler
	client.connect = function (probe)
	{
		probes.push(probe);
	};

	// Probes
	probes = [];

	return client;
})();
