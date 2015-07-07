
var Future = require('./concurrent').Future;
var Query = require('./http').Query;

var Auction = {
	acceptBidder: function (bidder, auction)
	{
		var filters;

		if (bidder.id === undefined)
			return false;

		if (!bidder.bid_ep)
			return false;

		filters = bidder.filters;

		if (filters === undefined)
			return true;

		if (filters.sampling !== undefined && Math.random() * 100 > filters.sampling)
			return false;

		// if publisher country is not part of whitelist countries => bidder banished
		// if publisher country is part of blacklist countries => bidder banished
		if (filters.pub_ctry !== undefined &&
			filters.pub_ctry.length !== 0 &&
			auction.config.site.publisher.country !== undefined)
		{
			// if whitelist mode
			if (filters.pub_ctry_wl !== undefined && filters.pub_ctry_wl === true)
			{
				var ctryId = 0;

				for (; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === auction.config.site.publisher.country)
						break;
				}

				if (ctryId === filters.pub_ctry.length)
					return false;
			}
			else
			{
				for (var ctryId = 0; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === auction.config.site.publisher.country)
						return false;
				}
			}
		}

		// if user language is not part of whitelist language => bidder banished
		// if user language is part of blacklist language => bidder banished
		if (filters.user_lang !== undefined &&
			filters.user_lang.length !== 0)
		{
			// if whitelist mode
			if (filters.user_lang_wl !== undefined && filters.user_lang_wl === true)
			{
				var userLangId = 0;

				for (; userLangId < filters.user_lang.length; ++userLangId)
				{
					if (filters.user_lang[userLangId] === auction.request.device.language)
						break;
				}

				if (userLangId === filters.user_lang.length)
					return false;
			}
			else
			{
				for (var userLangId = 0; userLangId < filters.user_lang.length; ++userLangId)
				{
					if (filters.user_lang[userLangId] === auction.request.device.language)
						return false;
				}
			}
		}

		// if 1 site category of publisher is blacklisted per bidder => bidder banished
		if (filters.cat_bl !== undefined &&
			auction.config.site !== undefined &&
			auction.config.site.cat !== undefined)
		{
			for (var catId = 0; catId < filters.cat_bl.length; ++catId)
			{
				var catBl = filters.cat_bl[catId];

				if (auction.config.site.cat.contains(catBl))
					return false;
			}
		}

		// if the publisher domain is blacklisted per bidder => bidder banished
		if (filtes.pub !== undefined)
		{
			for (var pubId = 0; pubId < filters.pub.length; ++pubId)
			{
				var pubBl = filters.pub[pubId];

				if (auction.config.site.domain === pubBl)
					return false;
			}
		}

		return true;
	},

	begin: function (auction)
	{
		var futures = [];

		for (var i = 0; i < auction.bidders.length; ++i)
		{
			var bidder = auction.bidders[i];

			if (Auction.acceptBidder(bidder, auction))
				futures.push(Auction.send(auction, bidder));
			else
				futures.push(Future.make('filter', undefined));
		}

		return Future.bind.apply(null, futures);
	},

	end: function (auction, bidders, results, config, statUrl, sendDebug)
	{
		var bid;
		var currentPrice;
		var found;
		var index;
		var seatbid;
		var secondPrice;
		var winner;
		var domContainer;

		secondPrice = auction.config.imp[0].bidfloor;

		for (var i = 0; i < results.length; ++i)
		{
			var response = results[i][1];
			var status = results[i][0];

			if (status === 'expire')
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'timeout'
				});

				continue;
			}

			if (status === 'filter')
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_filter'
				});

				continue;
			}

			// FIXME: should not be reported as an error
			if (status === 'pass')
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'no bid'
				});

				continue;
			}

			if (status === 'empty' || !response || !response.seatbid)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'empty response'
				});

				continue;
			}

			if (response.cur && response.cur !== auction.request.cur)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'invalid currency'
				});

				continue;
			}

			seatbid = response.seatbid[0];

			if (!seatbid || !seatbid.bid)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'no bid'
				});

				continue;
			}

			bid = seatbid.bid[0];

			if (!bid || !bid.creative || !bid.price)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'no price'
				});

				continue;
			}

			if (!bid.ext || !bid.ext.signature)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'missing signature'
				});

				continue;
			}

			if (bid.impid && bid.impid != auction.request.imp[0].id)
			{
				sendDebug(auction._debug,
				{
					auction:	auction.id,
					bidder:		bidders[i].id,
					event:		'bid_error',
					reason:		'invalid imp id'
				});

				continue;
			}

			if (bid.adomain && bid.adomain.length > 0 && auction.request.badv)
			{
				found = false;

				for (var j = 0; !found && j < auction.request.badv.length; ++j)
				{
					for (var k = 0; !found && k < bid.adomain.length; ++k)
						found = auction.request.badv[j] === bid.adomain[k];
				}

				if (found)
				{
					sendDebug(auction._debug,
					{
						auction:	auction.id,
						bidder:		bidders[i].id,
						event:		'bid_error',
						reason:		'invalid advertiser domain'
					});

					continue;
				}
			}

			currentPrice = bid.price;

			sendDebug(auction._debug,
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

		sendDebug(auction._debug,
		{
			event:		'end',
			auction:	auction.id,
			winner:		bidders[index].id,
			price:		secondPrice
		});

		domContainer = Auction.makeSucceededHtml
		(
			winner.creative,
			winner.nurl,
			secondPrice
		);

		Auction.addPixel
		(
			Auction.renderImpressionPixel(config, auction, bidders, results, statUrl),
			domContainer
		);
	},

	makeSucceededHtml: function (creativeCode, notifyUrl, secondPrice)
	{
		var creativeImg;
		var pixel;

		creativeImg = document.createElement('div');
		creativeImg.innerHTML  = creativeCode;

		document.body.appendChild(creativeImg);

		if (notifyUrl)
		{
			Auction.addPixel(
				notifyUrl.replace('${AUCTION_PRICE}', secondPrice),
				document.body
			);
		}

		Auction.evalBodyJS(document.body);
		return creativeImg;
	},

	send: function (auction, bidder)
	{
		var timeout = new Future();

		// Schedule timeout response (HTTP 408)
		setTimeout(function ()
		{
			timeout.signal(undefined, 408);
		}, auction.config.tmax);

		// Wrap either actual bidder response or timeout
		return Future
			.first(Query.json(bidder.bid_ep, auction.request), timeout)
			.chain(function (json, status)
			{
				if (status === 408 || new Date().getTime() >= auction.timeout)
					return ['expire', undefined];

				if (status === 204)
					return ['pass', undefined];

				if (json === undefined)
					return ['empty', undefined];

				return ['take', json];
			});
	},

	evalBodyJS: function (body)
	{
		var apply;
		var node;
		var nodes;
		var trick;

		apply = function (node)
		{
			var child;
			var nodes = [];

			for (var i = 0; i < node.childNodes.length; ++i)
			{
				child = node.childNodes[i];

				if (child.nodeName.toUpperCase() === 'SCRIPT' && (!child.type || child.type.toLowerCase() === 'text/javascript'))
					nodes.push(child);
				else
					nodes = nodes.concat(apply(child));
			}

			return nodes;
		};

		function trick(elem)
		{
			var script = document.createElement('script');
			var source = elem.text || elem.textContent || elem.innerHTML || '';
			var target = document.getElementsByTagName('head')[0] || document.documentElement;

			script.src = elem.src;
			script.type = 'text/javascript';

			try
			{
				// Standard way to set script source code
				script.appendChild(document.createTextNode(source));
			}
			catch (e)
			{
				// Workaround for IE <= 7
				script.text = source;
			}

			target.insertBefore(script, target.firstChild);
			target.removeChild(script);
		};

		nodes = apply(body);

		for (i = 0; i < nodes.length; i++)
		{
			node = nodes[i];

			if (node.parentNode)
				node.parentNode.removeChild(node);

			trick(node);
		}
	},

	/*
	* Renders an impression pixel in the bottom of the ad
	*/
	renderImpressionPixel: function (config, auction, bidders, results, statUrl)
	{
		var bid;
		var bidder;
		var first;
		var response;
		var seatbid;
		var status;

		var parts = {
			'a': auction.id,
			'p': config.site.publisher.id,
			'f': auction.config.imp[0].bidfloor
		};

		for (var i = 0; i < results.length; i++)
		{
			response = results[i][1];
			status = results[i][0];

			if (!response || !response.seatbid || status !== 'take')
				continue;

			bidder = bidders[i];
			seatbid = response.seatbid[0];

			if (!seatbid || !seatbid.bid)
				continue;

			bid = seatbid[0];

			if (!bid || !bid.ext || !bid.ext.signature || !bid.price)
				continue;

			parts['d[' + bidders[i].id + ']'] = bid.price + '-' + bid.ext.signature;
		}

		for (var key in parts)
		{
			statUrl = statUrl + (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(parts[key]);

			first = false;
		}

		return statUrl;
	},

	addPixel: function (url, parent)
	{
		var pixel = document.createElement('img');
		pixel.height = '1px';
		pixel.width = '1px';
		pixel.src = url;
		parent.appendChild(pixel);
	}
};

// Module exports
exports.Auction = Auction;
