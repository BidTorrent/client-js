
var Element = require('./dom').Element;
var Future = require('../concurrent').Future;
var Query = require('../http').Query;

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

	applyMacros: function (template, auction, secondPrice)
	{
		return template
			.replace('${AUCTION_AD_ID}', '')
			.replace('${AUCTION_BID_ID}', '')
			.replace('${AUCTION_CURRENCY}', '')
			.replace('${AUCTION_ID}', auction.id)
			.replace('${AUCTION_IMP_ID}', '')
			.replace('${AUCTION_SEAT_ID}', '')
			.replace('${AUCTION_PRICE}', secondPrice)
			.replace('${CLICK_URL}', '');
	},

	begin: function (auction, debug)
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

		debug('init_valid', {bidders: auction.bidders});

		return Future.bind.apply(null, futures);
	},

	end: function (auction, bidders, results, config, statUrl, debug)
	{
		var bid;
		var creative;
		var pass;
		var seatbid;
		var secondPrice;
		var winnerBid;
		var winnerBidder;

		secondPrice = auction.config.imp[0].bidfloor;

		for (var i = 0; i < results.length; ++i)
		{
			var response = results[i][1];
			var status = results[i][0];

			if (status === 'expire')
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'timeout'});

				continue;
			}

			if (status === 'filter')
			{
				debug('bid_filter', {bidder: bidders[i].id});

				continue;
			}

			// FIXME: should not be reported as an error
			if (status === 'pass')
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'no bid'});

				continue;
			}

			if (status === 'empty' || !response || !response.seatbid)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'empty response'});

				continue;
			}

			// Check currency against allowed ones
			if (response.cur)
			{
				pass = false;

				for (var j = 0; !pass && j < auction.request.cur.length; ++j)
					pass = response.cur === auction.request.cur[j];

				if (!pass)
				{
					debug('bid_error', {bidder: bidders[i].id, reason: 'invalid currency "' + response.cur + '"'});

					continue;
				}
			}

			// Find first seat if any
			seatbid = response.seatbid[0];

			if (!seatbid || !seatbid.bid)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'no bid'});

				continue;
			}

			// Find first bid if any
			bid = seatbid.bid[0];

			if (!bid || !bid.adm)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'missing creative'});

				continue;
			}

			if (!bid.price)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'missing or zero price'});

				continue;
			}

			if (!bid.ext || !bid.ext.signature)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'missing signature'});

				continue;
			}

			if (bid.impid && bid.impid != auction.request.imp[0].id)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'invalid imp id'});

				continue;
			}

			if (bid.adomain && bid.adomain.length > 0 && auction.request.badv)
			{
				pass = true;

				for (var j = 0; pass && j < auction.request.badv.length; ++j)
				{
					for (var k = 0; pass && k < bid.adomain.length; ++k)
						pass = auction.request.badv[j] !== bid.adomain[k];
				}

				if (!pass)
				{
					debug('bid_error', {bidder: bidders[i].id, reason: 'invalid advertiser domain'});

					continue;
				}
			}

			debug('bid_valid', {bidder: bidders[i].id, price: bid.price});

			if (winnerBid === undefined || winnerBid.price < bid.price)
			{
				if (winnerBid !== undefined)
					secondPrice = winnerBid.price;

				winnerBidder = bidders[i];
				winnerBid = bid;
			}
			else if (secondPrice === undefined || bid.price > secondPrice)
				secondPrice = bid.price;
		}

		// Build and insert creative element
		creative = document.createElement('div');

		document.body.appendChild(creative);

		if (winnerBid !== undefined)
		{
			secondPrice += 0.01;

			Element.html(creative, Auction.applyMacros(winnerBid.adm, auction, secondPrice));

			if (winnerBid.nurl)
				Element.pixel(document.body, Auction.applyMacros(winnerBid.nurl, auction, secondPrice));

			if (statUrl)
				Element.pixel(document.body, Auction.renderImpressionPixel(config, auction, bidders, results, statUrl));

			debug('end', {winner: winnerBidder.id, price: secondPrice});
		}
		else
			Element.html(creative, auction.config.passback || '');
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
			.chain(function (response, status)
			{
				if (status === 408 || new Date().getTime() >= auction.timeout)
					return ['expire', undefined];

				if (status === 204)
					return ['pass', undefined];

				if (response === undefined)
					return ['empty', undefined];

				return ['take', response];
			});
	},

	/*
	* Renders an impression pixel in the bottom of the ad
	*/
	renderImpressionPixel: function (config, auction, bidders, results, statUrl)
	{
		var bid;
		var bidder;
		var first;
		var parts;
		var response;
		var seatbid;
		var status;

		parts = {};

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

			bid = seatbid.bid[0];

			if (!bid || !bid.ext || !bid.ext.signature || !bid.price)
				continue;

			parts['a'] = auction.id + '-' + bid.impid; // FIXME: doesn't work if we receive responses for different impression ids
			parts['d[' + bidders[i].id + ']'] = bid.price + '-' + bid.ext.signature;
		}

		first = true;
		parts['f'] = auction.config.imp[0].bidfloor; // FIXME: should be the same impression we extracted bids for (see above)
		parts['p'] = config.site.publisher.id;

		for (var key in parts)
		{
			statUrl = statUrl + (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(parts[key]);
			first = false;
		}

		return statUrl;
	}
};

// Module exports
exports.Auction = Auction;
