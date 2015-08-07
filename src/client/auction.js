
var DOM = require('../dom').DOM;
var Future = require('../future').Future;
var HTTP = require('../http').HTTP;
var Signature = require('./signature').Signature;

var Auction = {
	acceptBidder: function (config, auction, bidder)
	{
		var filters;

		if (bidder.id === undefined || bidder.key === undefined || !bidder.bid_ep)
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
			config.site.publisher.country !== undefined)
		{
			// if whitelist mode
			if (filters.pub_ctry_wl !== undefined && filters.pub_ctry_wl === true)
			{
				var ctryId = 0;

				for (; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === config.site.publisher.country)
						break;
				}

				if (ctryId === filters.pub_ctry.length)
					return false;
			}
			else
			{
				for (var ctryId = 0; ctryId < filters.pub_ctry.length; ++ctryId)
				{
					if (filters.pub_ctry[ctryId] === config.site.publisher.country)
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
			config.site !== undefined &&
			config.site.cat !== undefined)
		{
			for (var catId = 0; catId < filters.cat_bl.length; ++catId)
			{
				var catBl = filters.cat_bl[catId];

				if (config.site.cat.contains(catBl))
					return false;
			}
		}

		// if the publisher domain is blacklisted per bidder => bidder banished
		if (filtes.pub !== undefined)
		{
			for (var pubId = 0; pubId < filters.pub.length; ++pubId)
			{
				var pubBl = filters.pub[pubId];

				if (config.site.domain === pubBl)
					return false;
			}
		}

		return true;
	},

	begin: function (config, auction, debug)
	{
		var futures = [];

		for (var i = 0; i < auction.bidders.length; ++i)
		{
			var bidder = auction.bidders[i];

			if (Auction.acceptBidder(config, auction, bidder))
				futures.push(Auction.send(config, auction, bidder));
			else
				futures.push(Future.make('filter', undefined));
		}

		debug('init_valid', {bidders: auction.bidders});

		return Future.bind.apply(null, futures);
	},

	end: function (auction, bidders, results, config, impUrl, debug)
	{
		var bid;
		var candidates;
		var creative;
		var pass;
		var seatbid;
		var secondPrice;
		var winnerBid;
		var winnerBidder;

		candidates = [];
		secondPrice = config.imp[0].bidfloor;

		for (var i = 0; i < results.length; ++i)
		{
			var action = results[i][0];
			var data = results[i][1];

			if (action === 'error')
			{
				debug('bid_error', {bidder: bidders[i].id, reason: data});

				continue;
			}

			if (action === 'filter')
			{
				debug('bid_filter', {bidder: bidders[i].id});

				continue;
			}

			if (action === 'pass')
			{
				debug('bid_pass', {bidder: bidders[i].id});

				continue;
			}

			if (action === 'empty' || !data || !data.seatbid)
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'empty response'});

				continue;
			}

			if (action !== 'take')
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'unknown error'});

				continue;
			}

			// Check currency against allowed ones
			if (data.cur)
			{
				pass = false;

				for (var j = 0; !pass && j < auction.request.cur.length; ++j)
					pass = data.cur === auction.request.cur[j];

				if (!pass)
				{
					debug('bid_error', {bidder: bidders[i].id, reason: 'invalid currency "' + data.cur + '"'});

					continue;
				}
			}

			// Find first seat if any
			seatbid = data.seatbid[0];

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

			if (!Signature.check(bid.price, auction.request.id + '-' + config.imp[0].id, config.site.publisher.id, config.imp[0].bidfloor, bidders[i].key, bid.ext.signature))
			{
				debug('bid_error', {bidder: bidders[i].id, reason: 'invalid signature'});

				continue;
			}

			// Valid bid received, append to candidates list
			candidates.push({
				bidder:		bidders[i].id,
				impid:		bid.impid,
				price:		bid.price,
				signature:	bid.ext.signature
			});

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

			DOM.html(creative, Auction.renderMacro(winnerBid.adm, auction, secondPrice));

			if (impUrl)
				DOM.pixel(document.body, Auction.renderImpression(impUrl, config, auction, candidates));

			if (winnerBid.nurl)
				DOM.pixel(document.body, Auction.renderMacro(winnerBid.nurl, auction, secondPrice));

			debug('end', {winner: winnerBidder.id, price: secondPrice});
		}
		else
		{
			DOM.html(creative, config.imp[0].passback || '');

			debug('end', {price: secondPrice});
		}
	},

	send: function (config, auction, bidder)
	{
		var timeout = new Future();

		// Schedule timeout response (HTTP 408)
		setTimeout(function ()
		{
			timeout.signal(undefined, 408);
		}, config.tmax);

		// Wrap either actual bidder response or timeout
		return Future
			.first(HTTP.json(bidder.bid_ep, auction.request), timeout)
			.chain(function (response, status)
			{
				if (new Date().getTime() >= auction.timeout)
					status = 408;

				if (status >= 400 && status < 600)
					return ['error', status];

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
	renderImpression: function (impUrl, config, auction, candidates)
	{
		var candidate;
		var first;
		var parts;

		parts = {};

		for (var i = 0; i < candidates.length; i++)
		{
			candidate = candidates[i];

			parts['a'] = auction.id + '-' + candidate.impid; // FIXME: doesn't work if we receive responses for different impression ids
			parts['d[' + candidate.bidder + ']'] = candidate.price + '-' + candidate.signature;
		}

		first = true;
		parts['f'] = config.imp[0].bidfloor; // FIXME: should be the same impression we extracted bids for (see above)
		parts['p'] = config.site.publisher.id;

		for (var key in parts)
		{
			impUrl = impUrl + (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(parts[key]);
			first = false;
		}

		return impUrl;
	},

	renderMacro: function (template, auction, secondPrice)
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
	}
};

// Module exports
exports.Auction = Auction;
