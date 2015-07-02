/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/
(function ()
{
	var Future = function ()
	{
		this.arguments = undefined;
		this.complete = undefined;
	};

	Future.bind = function ()
	{
		var complete;
		var future;
		var results;
		var wait;

		future = new Future();

		if (arguments.length <= 0)
			future.signal();
		else
		{
			complete = function (index)
			{
				return function ()
				{
					results[index] = arguments;

					if (--wait <= 0)
						future.signal.apply(future, results);
				};
			};

			results = new Array(arguments.length);
			wait = arguments.length;

			for (var i = 0; i < arguments.length; ++i)
				arguments[i].then(complete(i));
		}

		return future;
	};

	Future.first = function ()
	{
		var complete;
		var future;
		var wait;

		complete = function (futures)
		{
			return function ()
			{
				if (wait)
				{
					wait = false;

					for (var i = 0; i < futures.length; ++i)
						futures[i].signal();

					future.signal.apply(future, arguments);
				}
			};
		};

		future = new Future();
		wait = true;

		for (var i = 0; i < arguments.length; ++i)
			arguments[i].then(complete(arguments));

		return future;
	};

	Future.make = function ()
	{
		var future;

		future = new Future();
		future.signal.apply(future, arguments);

		return future;
	};

	Future.prototype.signal = function ()
	{
		if (this.arguments !== undefined)
			return false;

		this.arguments = arguments;

		if (this.complete !== undefined)
			this.complete.apply(null, arguments);

		return true;
	};

	Future.prototype.then = function (complete)
	{
		if (this.arguments !== undefined)
			complete.apply(null, this.arguments);
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
			.then(function(biddersArgs, configArgs)
			{
				var bidders = biddersArgs[0];
				var config = configArgs[0];

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
			expire:		new Date().getTime() + config.tmax,			
			id:			id,
			_debug:		debug
		}

		sendDebug(auction,
		{
			event:		'begin',
			auction:	auction.id,
			bidders:	bidders
		});

		auctionBegin(auction).then(function ()
		{
			auctionEnd(auction, bidders, arguments);
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

	var auctionEnd = function (auction, bidders, results)
	{
		var bid;
		var currentPrice;
		var index;
		var seatbid;
		var secondPrice;
		var timeout;
		var winner;

		secondPrice = auction.config.floor;
		timeout = new Date().getTime() >= auction.timeout;

		for (var i = 0; i < results.length; ++i)
		{
			var result = results[i][0];

			if (timeout)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter',
					reason:		'timeout'
				});

				continue;
			}

			if (result === undefined || result.seatbid === undefined)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter',
					reason:		'empty'
				});

				continue;
			}

			seatbid = result.seatbid[0];

			if (seatbid === undefined || seatbid.bid === undefined)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter',
					reason:		'nobid'
				});

				continue;
			}

			bid = seatbid.bid[0];

			if (bid === undefined || bid.creative === undefined || bid.price === undefined || bid.price <= 0)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter',
					reason:		'corrupted'
				});

				continue;
			}

			currentPrice = bid.price;

			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidders[i].id,
				event:		'bid_valid',
				price:		currentPrice
			});

			if (winner === undefined || winner.price < currentPrice)
			{
				if (winner !== undefined)
					secondPrice = winner.price;

				index = i;
				winner = bid;
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

		sendDebug(auction,
		{
			event:		'end',
			auction:	auction.id,
			winner:		bidders[index].id,
			price:		secondPrice
		});

		makeSucceededHtml
		(
			winner.creative,
			winner.nurl,
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
			if (timeout.signal(/*bidder*/))
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

		if ((filters = bidder.filters) === undefined)
			return true;

		if (filters.sampling !== undefined && Math.random() > filters.sampling)
			return false;

		if (filters.cat_bl !== undefined && auction.site !== undefined && auction.site.cat !== undefined)
		{ 
			for (var cat in filters.cat_bl)
				if (auction.site.cat.contains(cat))
					return false;
		}

		if (filters.pub !== undefined && filters.pub === auction.config.site.publisher.name)
	   		return false;

		return true;
	}

	var makeSucceededHtml = function (creativeCode, notifyUrl, secondPrice)
	{
		var creativeImg;
		var pixel;

		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		document.body.appendChild(creativeImg);

		if (notifyUrl)
		{
			pixel = document.createElement('img');
			pixel.height = '1px';
			pixel.width = '1px';
			pixel.src = notifyUrl.replace('${AUCTION_PRICE}', secondPrice);

			document.body.appendChild(pixel);
		}
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

			if (xhr.readyState !== 4)
				return;

			if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0)
			{
				try
				{
					json = JSON.parse(xhr.responseText);
				}
				catch (e)
				{
					json = undefined;
				}
			}
			else
				json = undefined;

			future.signal(json);
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
