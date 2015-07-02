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

				config = config || {};
				config.floor = config.floor || 0.01;
				config.slot = config.slot || {};
				config.slot.width = config.slot.width || 300;
				config.slot.height = config.slot.height || 250;
				config.passback = config.passback || '';
				config.publisher = config.publisher || document.location.href;
				config.timeout = config.timeout || 500;

				everythingLoaded(bidders, config, debug ? id : undefined);
			});
	};

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
            request:	formatBidRequest(id, config, config.slot),
			bidders:	bidders,
			config:		config,
			id:			id,
			slot: 		config.slot.id,
			timeout:	new Date().getTime() + config.timeout,
            _debug:     debug
		}

		sendDebug(auction,
		{
			event:		'begin',
			container:	config.slot.id,
			auction:	auction.id,
			bidders:	bidders
		});

		auctionBegin(auction).then(function (results)
		{
			auctionEnd(auction, results);
		});
	}

    var formatBidRequest = function (id, publisherConfig, slot)
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
			img: [{
				banner: {
					h: slot.height,
					id: slot.id,
					w: slot.width
				}
			}],
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
				container:	auction.slot,
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

        for (var id in auction.bidders)
        {
            var bidder = auction.bidders[id];

            if (acceptBidder(bidder, auction))
                futures.push(auctionSend(auction, id, bidder));
        }

		return Future.bind.apply(null, futures);
	};

    var auctionSend = function (auction, bidderId, bidder)
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
					bidder:		bidderId,
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
					bidder:		bidderId,
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
					bidder:		bidderId,
					event:		'bid_filter',
					reason:		'nobid'
				});

				response.signal();

				return;
			}
			else if (result.seatbid[0].bid !== undefined)
			{
				sendDebug(auction,
				{
					auction:	auction.id,
					bidder:		bidderId,
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
					bidder:		bidderId,
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
					bidder:		bidderId,
					event:		'bid_filter',
					reason:		'nobid'
				});

				response.signal();

				return;
			}

			sendDebug(auction,
			{
				auction:	auction.id,
				bidder:		bidderId,
				event:		'bid_valid',
				price:		bid.price
			});

			response.signal
			({
				creative:	bid.creative,
				id:			bidderId,
				notify:		bid.nurl,
				price:		bid.price
			});
		});

		setTimeout(function () { timeout.signal(); }, auction.timeout);

		return Future.first(response, timeout);
	};

    var acceptBidder = function (bidder, auction)
    {
        // TODO probably read configuration before
        /*for (var propertyKey in bidder)
        {
            if (propertyKey === "filters")
            {
                for (var filterKey in bidder["filters"])
                {
                    if (filterKey == "sampling")
                    {

                    }
                }
            }
        }*/

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
			window.parent.postMessage({data: data, id: auction._debug}, auction.config.publisher);
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
