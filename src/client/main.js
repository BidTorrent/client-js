
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
			var parse;
			var slot;

			// Populate initialization object with missing default value
			init = init || {};

			if (init.config === undefined)
			{
				console.error('[bidtorrent] no configuration object/URL specified');
				return;
			}

			init.auction = url(init.auction || 'http://bidtorrent.io/auction.html');
			init.bidders = url(init.bidders || 'http://www.bidtorrent.io/api/bidders');
			init.config = url(init.config);
			init.slots = init.slots || [];
			init.statUrl = url(init.statUrl || 'http://stat.bidtorrent.io/imp');

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
				iframe.onload = (function (index, slot)
				{
					return function ()
					{
						iframe.contentWindow.postMessage({
							bidders:	init.bidders,
							config:		init.config,
							debug:		init.debug,
							index:		index,
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

					addEventListener('message', (function (debug, current)
					{
						return function (message)
						{
							if (message.origin === parse.protocol + '//' + parse.hostname && message.data.id === current)
							{
								for (var i = 0; i < probes.length; ++i)
									probes[i](debug, message.data.data);
							}
						};
					})(debug, i), true);
				}
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
