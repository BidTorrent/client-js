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
		var result;
		var wait;

		complete = function (index)
		{
			return function (value)
			{
				result[index] = value;

				if (--wait <= 0)
					future.signal(result);
			};
		};

		future = new Future();
		result = new Array(arguments.length);
		wait = arguments.length;

		for (var i = 0; i < arguments.length; ++i)
			arguments[i].then(complete(i));

		if (arguments.length <= 0)
			future.signal(result);

		return future;
	};

	Future.first = function ()
	{
		var complete;
		var future;
		var wait;

		complete = function (value)
		{
			if (wait)
				future.signal(value);

			wait = false;
		};

		future = new Future();
		wait = true;

		for (var i = 0; i < arguments.length; ++i)
			arguments[i].then(complete);

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
			return;

		this.ready = true;
		this.value = value;

		if (this.complete !== undefined)
			this.complete(value);
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
		var id = event.data.id;

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

				everythingLoaded(bidders, config, debug ? id : undefined);
			});
	};

	var applyDefaultValue = function(config)
	{
		config = config || {};
		config.cur = config.cur || "EUR";
		config.imp = config.imp || {};
		config.imp.bidfloor = config.imp.bidfloor || 0.01;
		config.imp.banner = config.imp.banner || {};
		config.imp.banner.w = config.imp.banner.w || 300;
		config.imp.banner.h = config.imp.banner.h || 250;
		config.passback = config.passback || '';
		config.site = config.site || {};
		config.site.domain = config.site.domain || "bidtorrent.com";
		config.site.publisher = config.site.publisher || {};
		config.site.publisher.id = config.site.publisher.id || 123;
		config.site.publisher.country = config.site.publisher.country || "FR";
		config.tmax = config.tmax || 500;
	}

	var everythingLoaded = function (bidders, config, debug)
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
			request:	formatBidRequest(id, config),
			bidders:	bidders,
			config:		config,
			id:			id,
			timeout:	new Date().getTime() + config.timeout,
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
			auctionEnd(auction, results);
		});
	}

	var formatBidRequest = function (id, publisherConfig)
	{
		var auctionRequest;
		var impression;

		auctionRequest =
		{
			badv: publisherConfig.badv,
			bcat: publisherConfig.bcat,
			cur: publisherConfig.cur,
			device: {
				//auctionRequest["device"]["geo"] = {};
				//auctionRequest["device"]["geo"]["country"] = myCountry;
				//auctionRequest["device"]["ip"] = myIp;
				//auctionRequest["device"]["js"] = 1;
				//auctionRequest["device"]["language"] = myLanguage;
				//auctionRequest["device"]["make"] = myMake;
				//auctionRequest["device"]["model"] = myModel;
				//auctionRequest["device"]["os"] = myOs;
				//auctionRequest["device"]["ua"] = myUa;
			},
			id: id,
			img: [publisherConfig.img],
			site: publisherConfig.site,
			tmax: publisherConfig.tmax,
			user: {
//				id: 'a%3A1%3A%7Bi%3A42%3Bs%3A36%3A%22abc2ccbf-2636-4cf1-93b1-5f0f521ada22%22%3B%7D',
//				buyerid: 1000
			}
		};

		return auctionRequest;
	}

	var auctionEnd = function (auction, results)
	{
		var secondPrice;
		var winner;

		secondPrice = auction.config.floor;

		for (var i = 0; i < results.length; ++i)
		{
			var result = results[i];

			if (result === undefined || result.price === undefined || result.price <= 0)
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
				auction:	auction.id,
				winner:		winner.id,
				price:		secondPrice
			}
		);

		makeSucceededHtml
		(
			winner.creative,
			winner,
			secondPrice,
			'www.criteo.com'
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
		var response = new Future();
		var timeout = new Future();

		sendQuery(bidder.bid_ep, auction.request).then(function (result)
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

				response.signal();

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

				response.signal();

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

				response.signal();

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

				response.signal();

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

				response.signal();

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

				response.signal();

				return;
			}

			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidder.id,
				event:		'bid_valid',
				price:		bid.price
			});

			response.signal
			({
				creative:	bid.creative,
				id:			bidder.id,
				notify:		bid.nurl,
				price:		bid.price
			});
		});

		setTimeout(function () { timeout.signal(); }, auction.timeout);

		return Future.first(response, timeout);
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

	var makeSucceededHtml = function (creativeCode, winner, secondPrice, clickUrl)
	{
		var creativeImg;
		var pixel;

		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		pixel = document.createElement('img');
		pixel.height = '1px';
		pixel.width = '1px';

		pixel.src = winner.notify.replace('${AUCTION_PRICE}', secondPrice);
		pixel.src = pixel.src.replace('${CLICK_URL}', clickUrl);

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
