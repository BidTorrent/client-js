/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/
(function ()
{
	var Future = function ()
	{
		this.complete = undefined;
		this.ready = false;
		this.value = undefined;
	};

	Future.bind = function ()
	{
		var complete;
		var future;
		var values;
		var wait;

		complete = function (index)
		{
			return function (value)
			{
				values[index] = value;

				if (--wait <= 0)
					future.signal(values);
			};
		};

		future = new Future();
		values = new Array(arguments.length);
		wait = arguments.length;

		for (var i = 0; i < arguments.length; ++i)
			arguments[i].then(complete(i));

		if (arguments.length <= 0)
			future.signal(values);

		return future;
	};

	Future.first = function ()
	{
		var complete;
		var future;
		var wait;

		complete = function (futures)
		{
			return function (value)
			{
				if (wait)
				{
					wait = false;

					for (var i = 0; i < futures.length; ++i)
						futures[i].signal();

					future.signal(value);
				}
			};
		};

		future = new Future();
		wait = true;

		for (var i = 0; i < arguments.length; ++i)
			arguments[i].then(complete(arguments));

		return future;
	};

	Future.make = function (value)
	{
		var future;

		future = new Future();
		future.signal(value);

		return future;
	};

	Future.prototype.signal = function (value)
	{
		if (this.ready)
			return false;

		this.ready = true;
		this.value = value;

		if (this.complete !== undefined)
			this.complete(value);

		return true;
	};

	Future.prototype.then = function (complete)
	{
		if (this.ready)
			complete(this.value);
		else
			this.complete = complete;
	};

	var start = function (event)
	{
		var bidders = event.data.bidders;
		var config = event.data.config;
		var debug = event.data.debug;
		var index = event.data.index;
		var slot = event.data.slot;

		Future
			.bind
			(
				typeof bidders === 'string' ? sendQuery(bidders) : Future.make(bidders),
				typeof config === 'string' ? sendQuery(config) : Future.make(config)
			)
			.then(function(result)
			{
				var bidders = result[0];
				var config = result[1];

				applyDefaultValue(config);

				everythingLoaded(bidders, config, slot, debug ? index : undefined);
			});
	};

	var applyDefaultValue = function(config)
	{
		config = config || {};
		config.cur = config.cur || "EUR";
		config.passback = config.passback || '';
		config.site = config.site || {};
		config.site.domain = config.site.domain || "bidtorrent.com";
		config.site.publisher = config.site.publisher || {};
		config.site.publisher.id = config.site.publisher.id || 123;
		config.site.publisher.country = config.site.publisher.country || "FR";
		config.tmax = config.tmax || 500;
	}

	var everythingLoaded = function (bidders, config, slot, debug)
	{
		var makeGuid = function ()
		{
			function S4()
			{
				return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
			}

			return (S4() + S4() + "-" + S4() +
				"-" + S4().substr(0,3) + "-" +
				S4() + "-" + S4() + S4() + S4()).toLowerCase();
		}

		var auction;
		var id;

		id = makeGuid();

		auction =
		{
			request:	formatBidRequest(id, config, slot),
			bidders:	bidders,
			config:		config,
			id:			id,
			timeout:	new Date().getTime() + config.tmax,
			_debug:	 debug
		}

		sendDebug(auction,
		{
			event:		'begin',
			auction:	auction.id,
			bidders:	bidders
		});

		auctionBegin(auction).then(function (results)
		{
			// FIXME: ugly
			for (var i = 0; i < bidders.length; ++i)
				displayDebugInformation(auction, bidders[i], results[i]);

			auctionEnd(auction, results);
		});
	}

	var formatBidRequest = function (id, config, slot)
	{
		var auctionRequest;
		var impression;

		auctionRequest =
		{
			badv: config.badv,
			bcat: config.bcat,
			cur: config.cur,
			device: {
				js: 1,
				language: navigator.language,
				ua: navigator.userAgent
			},
			id: id,
			imp: [{
				banner: {
					w:	slot.width,
					h:	slot.height
				},
				bidfloor: slot.floor
			}],
			site: config.site,
			tmax: config.tmax,
			user: {}
		};

		return auctionRequest;
	};

	var displayDebugInformation = function (auction, bidder, result)
	{
		var bids;
		var bid;

		if (new Date().getTime() >= auction.timeout)
		{
			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_filter',
				reason:		'timeout'
			});

			return;
		}
		else if (result === undefined)
		{
			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_filter',
				reason:		'corrupted'
			});

			return;
		}
		else if (result.seatbid.length === 0)
		{
			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_filter',
				reason:		'nobid'
			});

			return;
		}
		else if (result.seatbid[0].bid === undefined)
		{
			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_filter',
				reason:		'corrupted'
			});

			return;
		}

		bids = result.seatbid[0].bid;

		if (bids.length === 0)
		{
			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_filter',
				reason:		'nobid'
			});

			return;
		}

		bid = bids[0];

		if (bid.price === undefined || bid.creative === undefined)
		{
			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_filter',
				reason:		'nobid'
			});

			return;
		}

		sendDebug(auction,
		{
			auction:	auction.id,
			bidder:		bidder.id,
			event:		'bid_valid',
			price:		bid.price
		});
	};

	var auctionEnd = function (auction, results)
	{
		var currentPrice;
		var secondPrice;
		var winner;

		secondPrice = auction.config.floor;

		for (var i = 0; i < results.length; ++i)
		{
			var result = results[i];

			if (result === undefined || result.bid === undefined || result.bid.price === undefined || result.bid.price <= 0)
				continue;

			currentPrice = result.bid.price;

			if (winner === undefined || winner.bid.price < currentPrice)
			{
				if (winner !== undefined)
					secondPrice = winner.bid.price;

				winner = result;
			}
			else if (secondPrice === undefined || currentPrice > secondPrice)
				secondPrice = currentPrice;
		}

		if (winner === undefined)
		{
			document.body.innerHTML = auction.config.passback;

			return;
		}

		secondPrice += 0.01;

		sendDebug(auction, {
			event:		'end',
			auction:	auction.id,
			winner:		winner.id,
			price:		secondPrice
		});

		makeSucceededHtml
		(
			winner.bid.creative,
			winner.bid.nurl,
			secondPrice
		);
	};

	var auctionBegin = function (auction)
	{
		var futures = [];

		for (var i = 0; i < auction.bidders.length; ++i)
		{
			var bidder = auction.bidders[i];

			if (acceptBidder(bidder, auction))
				futures.push(auctionSend(auction, bidder));
		}

		return Future.bind.apply(null, futures);
	};

	var auctionSend = function (auction, bidder)
	{
		var timeout = new Future();

		setTimeout(function ()
		{
			if (timeout.signal())
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidder.id,
					event:		'bid_filter',
					reason:		'timeout'
				});
			}
		}, auction.config.tmax);

		return Future.first(sendQuery(bidder.bid_ep, auction.request), timeout);
	};

	// TODO: test country bl & language
	var acceptBidder = function (bidder, auction)
	{
		var filters;

		if((filters = bidder.filters) === undefined)
			return true;

		if(filters.sampling !== undefined && Math.random() > filters.sampling)
			return false;

		if(filters.cat_bl !== undefined && auction.site !== undefined && auction.site.cat !== undefined)
		{ 
			for (catBl in filters.cat_bl)
				if(auction.site.cat.contains(catBl))
					return false;
		}

		if(filters.pub !== undefined && filters.pub === auction.config.site.publisher.name)
	   		return false;

		return true;
	}

	var makeSucceededHtml = function (creativeCode, notifyUrl, secondPrice)
	{
		var creativeImg;
		var pixel;

		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		if (notifyUrl)
		{
			pixel = document.createElement('img');
			pixel.height = '1px';
			pixel.width = '1px';
			pixel.src = notifyUrl.replace('${AUCTION_PRICE}', secondPrice);
		}

		document.body.appendChild(creativeImg);
		document.body.appendChild(pixel);
	}

	var sendDebug = function (auction, data)
	{
		if (auction._debug !== undefined)
			window.parent.postMessage({data: data, id: auction._debug}, document.location.href);
	};

	var sendQuery = function (url, data)
	{
		var future;
		var xhr;

		future = new Future();

		xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function ()
		{
			var json;

			if (xhr.readyState == 4 && ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 0))
			{
				try
				{
					json = JSON.parse(xhr.responseText);
				}
				catch (e)
				{
					json = undefined;
				}

				future.signal(json);
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

		return future;
	};

	addEventListener('message', start, false);
})();
