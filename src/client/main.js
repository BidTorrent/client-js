
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
			var iframe;
			var listener;
			var parse;
			var slot;

			// Populate initialization object with missing default value
			init = init || {};

			if (init.config === undefined && init.configUrl === undefined)
			{
				console.error('[bidtorrent] no configuration object/URL specified');
				return;
			}

			init.auction = url(init.auction || 'http://bidtorrent.io/auction.html');
			init.bidders = url(init.bidders || 'http://www.bidtorrent.io/api/bidders');
			init.configUrl = url(init.configUrl);
			init.slots = init.slots || [];
			init.statUrl = url(init.statUrl || 'http://stats.bidtorrent.io/imp');

			// Start auctions on each configured slot
			for (var i = 0; i < init.slots.length; ++i)
			{
				// Assign default values to slot parameters
				slot = init.slots[i];
				slot.element = slot.element || 'bidtorrent-ad';

				if (typeof slot.element === 'string')
					slot.element = document.getElementById(slot.element);

				if (!slot.element)
				{
					console.error('[bidtorrent] no element configured for slot #' + i);
					continue;
				}

				slot.floor = slot.floor || 0;
				slot.height = slot.height || slot.element.offsetHeight;
				slot.width = slot.width || slot.element.offsetWidth;

				// Create and append auction iframe
				iframe = document.createElement('iframe');
				iframe.onload = (function (channel, slot)
				{
					return function ()
					{
						iframe.contentWindow.postMessage({
							bidders:	init.bidders,
							channel:	channel,
							config:		init.config,
							configUrl:	init.configUrl,
							debug:		init.debug,
							slots:		[{
								floor:	slot.floor,
								height:	slot.height,
								width:	slot.width
							}],
							statUrl: 	init.statUrl
						}, '*');
					};
				})(i, slot);

				iframe.frameBorder = 0;
				iframe.height = slot.height + 'px';
				iframe.scrolling = 'no';
				iframe.seamless = 'seamless';
				iframe.width = slot.width + 'px';
				iframe.src = init.auction;

				slot.element.appendChild(iframe);

				// Create and append debug mode iframe
				if (init.debug)
				{
					debug = document.createElement('div');
					debug.className = 'bidtorrent-debug';
					debug.style.width = slot.width + 'px';

					slot.element.appendChild(debug);

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
								alert('[BidTorrent] ' + message.data.message);

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
