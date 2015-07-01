
/*
** BidTorrent loader component.
** copyright the BidTorrent team 2015
*/
bidTorrent = (function ()
{
	var client;
	var probes;

	// BidTorrent JavaScript client
	client = function (init)
	{
		var loader;

		// Create the actual loading function
		loader = function ()
		{
			var debug;
			var iframe;
			var parse;
			var slot;

			// Populate initialization object with missing default value
			init = init || {};
			init.auction = init.auction || 'http://bidtorrent.io/auction.html';
			init.slots = init.slots || [];

			if (!init.config)
			{
				console.error('[bidtorrent] no configuration object/URL specified');
				return;
			}

			// Forward messages to connected probes
			if (init.debug_fixme !== undefined)
			{
				debug = document.getElementById(init.debug);

				if (debug)
				{
					parse = document.createElement('a');
					parse.href = init.base;

					addEventListener('message', function (message)
					{
						if (message.origin === parse.protocol + '//' + parse.hostname)
						{
							for (var i = 0; i < probes.length; ++i)
								probes[i](debug, message.data);
						}
					}, true);
				}
			}

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

				slot.height = slot.height || slot.element.offsetHeight;
				slot.width = slot.width || slot.element.offsetWidth;

				// Create and append auction iframe
				iframe = document.createElement('iframe');
				iframe.onload = function ()
				{
					iframe.contentWindow.postMessage(init.config, '*');
				};

				iframe.frameBorder = 0;
				iframe.height = slot.height + 'px';
				iframe.seamless = 'seamless';
				iframe.scrolling = 'no';
				iframe.width = slot.width + 'px';
				iframe.src = init.auction;

				slot.element.appendChild(iframe);
			}
		};

		// Execute loader callback when page is loaded or synchronously
		if (document.readyState === 'complete' || document.readyState === 'loaded')
			loader();
		else
			document.addEventListener('DOMContentLoaded', loader, false);
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
