
/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/
(function ()
{
	var auctionBegin = function (auction)
	{
		for (var id in auction.bidders)
		{
			++auction.pending;

			auctionSend(auction, id, auction.bidders[id]);
		}
	};

	var auctionEnd = function (auction)
	{
		var secondPrice;
		var winner;

		secondPrice = auction.config.floor;

		for (var i = 0; i < auction.results.length; ++i)
		{
			var result = auction.results[i];

			if (result.price === undefined || result.price <= 0)
				continue;

			if (winner === undefined || winner.price < result.price)
			{
				if (winner !== undefined)
					secondPrice = winner.price;

				winner = result;
			}
			else if (secondPrice === undefined || result.price > secondPrice)
				secondPrice = result.price;
		}

		if (winner === undefined)
		{
			document.body.innerHTML = auction.config.passback;

			return;
		}
		
		secondPrice += 0.01;
		sendDebug
		(
			auction,
			{
				event:		'end',
				container:	auction.slot,
				auction:	auction.id,
				winner:		winner.id,
				price:		secondPrice
			}
		);
		
		makeSucceededHtml(winner.creative, winner, secondPrice);
	};
	
	var makeSucceededHtml = function(creativeCode, winner, secondPrice)
	{
		var creativeImg;
		var pixel;
		
		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		pixel = document.createElement('img');
		pixel.height = '1px';
		pixel.width = '1px';
		pixel.src = winner.notify.replace('{winningprice}', secondPrice.toString());

		document.body.appendChild(creativeImg);
		document.body.appendChild(pixel);
	}
	
	var auctionSend = function (auction, id, bidder)
	{
		sendQuery
		(
			bidder.bid_ep,
			{
				publisher:	auction.config.publisher,
				width:		auction.config.slot.width,
				height:		auction.config.slot.height
			},
			function (result)
			{
				if (auction.pending === 0)
					return;

				if (new Date().getTime() >= auction.timeout)
				{
					sendDebug(auction, {
						event:		'bid_filter',
						auction:	auction.id,
						bidder:		id,
						reason:		'timeout'
					});
				}
				else if (result === undefined)
				{
					sendDebug(auction, {
						event:		'bid_filter',
						auction:	auction.id,
						bidder:		id,
						reason:		'corrupted'
					});
				}
				else if (result.creative === undefined || result.price === undefined)
				{
					sendDebug(auction, {
						event:		'bid_filter',
						auction:	auction.id,
						bidder:		id,
						reason:		'nobid'
					});
				}
				else
				{
					sendDebug(auction, {
						event:		'bid_valid',
						auction:	auction.id,
						bidder:		id,
						price:		result.price
					});

					auction.results.push({
						id:			id,
						creative:	result.creative,
						notify:		result.notify,
						price:		result.price
					});
				}

				if (--auction.pending === 0)
					auctionEnd(auction);
			}
		);
	};

	var sendDebug = function (auction, data)
	{
		if (auction._debug === undefined)
			return;

		window.parent.postMessage({data: data, id: auction._debug}, auction.config.publisher);
	};

	var sendQuery = function (url, data, complete)
	{
		var xhr;

		xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function ()
		{
			var json;

			if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0))
			{
				try
				{
					json = JSON.parse(xhr.responseText);
				}
				catch (e)
				{
					json = undefined;
				}

				complete(json);
			}
		};

		if (data !== undefined)
		{
			xhr.open('POST', url, true);
			xhr.send(JSON.stringify(data));
		}
		else
		{
			xhr.open('GET', url, true);
			xhr.send();
		}
	};

	var start = function (event)
	{
		var config = event.data.config;
		var debug = event.data.debug;
		var id = event.data.id;

		config = config || {};
		config.slot = config.slot || {};
		config.slot.width = config.slot.width || 300;
		config.slot.height = config.slot.height || 250;
		config.base = config.base || 'http://bidtorrent.io';
		config.ep = config.ep || {};
		config.ep.bidders = config.ep.bidders || config.base + '/bidders.json';
		config.floor = config.floor || 0.01;
		config.passback = config.passback || '';
		config.publisher = config.publisher || document.location.href;
		config.timeout = config.timeout || 500;

		sendQuery
		(
			config.ep.bidders,
			undefined,
			function (bidders)
			{
				var auction;

				auction =
				{
					bidders:	bidders,
					config:		config,
					id:			Math.floor(Math.random() * 10000000),
					pending:	0,
					results:	[],
					slot: 		config.slot.id,
					timeout:	new Date().getTime() + config.timeout,
					_debug:		debug ? id : undefined
				}

				sendDebug(auction, {
					event:		'begin',
					container:	config.slot.id,
					auction:	auction.id,
					bidders:	bidders
				});

				setTimeout(function ()
				{
					if (auction.pending === 0)
						return;

					auction.pending = 0;

					auctionEnd(auction);
				}, config.timeout);

				auctionBegin(auction);
			}
		);
	};

	addEventListener('message', start, false);
})();
