
(function (parent)
{
	if (parent.bidTorrent === undefined)
		return;

	/*
	** Human-readable description for common HTTP errors.
	*/
	var errors = {
		408:	'request timed out (bidder too slow)',
		502:	'request interrupted (ad blocker?)'
	};

	var swap_bidders = function (display, at, complete)
	{
		var i1 = 0;
		var i2 = at;
		var i3 = at + 1;

		var set1 = display.find('.bidder').slice(i1, i2);
		var set2 = display.find('.bidder').slice(i2, i3);
		var set3 = set2.last().nextAll();

		var mb_prev = cssprop(set1.first().prev(), "margin-bottom");

		if (isNaN(mb_prev))
			mb_prev = 0;

		var mt_next = cssprop(set2.last().next(), "margin-top");

		if (isNaN(mt_next))
			mt_next = 0;

		var mt_1 = cssprop(set1.first(), "margin-top");
		var mb_1 = cssprop(set1.last(), "margin-bottom");
		var mt_2 = cssprop(set2.first(), "margin-top");
		var mb_2 = cssprop(set2.last(), "margin-bottom");

		var h1 = set1.last().offset().top + set1.last().outerHeight() - set1.first().offset().top;
		var h2 = set2.last().offset().top + set2.last().outerHeight() - set2.first().offset().top;

		move1 = h2 + Math.max(mb_2, mt_1) + Math.max(mb_prev, mt_2) - Math.max(mb_prev, mt_1);
		move2 = -h1 - Math.max(mb_1, mt_2) - Math.max(mb_prev, mt_1) + Math.max(mb_prev, mt_2);
		move3 = move1 + set1.first().offset().top + h1 - set2.first().offset().top - h2 + Math.max(mb_1,mt_next) - Math.max(mb_2,mt_next);

		// let's move stuff
		set1.css('position', 'relative');
		set2.css('position', 'relative');
		set3.css('position', 'relative');

		var pending = set1.length + set2.length + set3.length;
		var arrange = function ()
		{
			if (--pending > 0)
				return;

			// rearrange the DOM and restore positioning when we're done moving
			set1.insertAfter(set2.last())
			set1.css({'position': 'static', 'top': 0});
			set2.css({'position': 'static', 'top': 0});
			set3.css({'position': 'static', 'top': 0});

			complete();
		};

		set1.animate({'top': move1}, {duration: 500, complete: arrange});
		set3.animate({'top': move3}, {duration: 500, complete: arrange});
		set2.animate({'top': move2}, {duration: 500, complete: arrange});
	};

	var cssprop = function (element, name)
	{
		return parseInt(element.css(name), 10);
	}

	var infoString = function ($elm)
	{
		return "    top: " + $elm.offset().top + ", mt: " + cssprop($elm, "margin-top") + ", mb: " + parseInt($elm.css("margin-bottom"), 10) + ", bb: " + parseInt($elm.css("border-bottom-width"), 10) + ", bt: " + parseInt($elm.css("border-top-width"), 10) + ", pb: " + parseInt($elm.css("padding-bottom"), 10) + ", pt: " + parseInt($elm.css("padding-top"), 10) + ", h: " + $elm.height() + ", ih: " + $elm.innerHeight() + ", oh: " + $elm.outerHeight() + ", oh(true): " + $elm.outerHeight(true);
	}

	var animate_list = [];
	var animate_lock = false;

	var animate_next = function ()
	{
		var pop;

		if (animate_lock)
			return;

		pop = animate_list.splice(0, 1);

		if (pop.length < 1)
			return;

		animate_lock = true;

		pop[0](function ()
		{
			animate_lock = false;

			animate_next();
		});
	};

	var animate_push = function (animation)
	{
		animate_list.push(animation);

		animate_next();
	};

	// FIXME: can be loaded after the function below is executed (=> crash, missing variable '$')
	var defer_queue = [];
	var defer_wait = 0;

	var defer = function (callback)
	{
		if (typeof callback === 'function')
			defer_queue.push(callback);

		if (defer_wait > 0)
			return;

		for (var i = 0; i < defer_queue.length; ++i)
			defer_queue[i]();

		defer_queue = [];
	};

	var defer_signal = function ()
	{
		if (defer_wait > 0 && --defer_wait === 0)
			defer();
	}

	// FIXME: wait for jQuery
	++defer_wait;
	var jquery = document.createElement('script');
	jquery.onload = defer_signal;
	jquery.src = 'https://code.jquery.com/jquery-1.11.3.min.js';
	jquery.type = 'text/javascript';
	document.body.appendChild(jquery);

	// FIXME: wait for CSS + hardcoded URL
	++defer_wait;
	var debugCss = document.createElement('link');
	debugCss.onload = defer_signal;
	debugCss.href = 'http://bidtorrent.io/debug-print.css';
	debugCss.rel = 'stylesheet';
	debugCss.type = 'text/css';
	document.body.appendChild(debugCss);

	// FIXME
	parent.bidTorrent.connect(function (element, flow, params)
	{
		defer(function ()
		{
			var bidder;
			var creative;
			var display;

			creative = $(element);
			display = creative.next('.bidtorrent-debug');

			if (display.length < 1)
			{
				display = $('<div class="bidtorrent-debug">')
					.css('width', creative.width() + 'px')
					.insertAfter(creative);
			}

			switch (flow)
			{
				case 'alert':
					console.error('[BidTorrent] ' + params.text);

					break;

				case 'init_error':
					creative.css('visibility', 'hidden');

					$('<div>')
							.addClass('error')
							.text('Configuration error: ' + params.reason)
							.appendTo(display);

					break;

				case 'init_valid':
					creative.css('visibility', 'hidden');

					for (var i = 0; i < params.bidders.length; ++i)
					{
						bidder = params.bidders[i];

						$('<div>')
							.append($('<span>').addClass('name').text(bidder.name))
							.append($('<span>').addClass('info').text('Pending...'))
							.addClass('bidder')
							.addClass('id-' + bidder.id)
							.appendTo(display);
					}

					break;

				case 'bid_error':
					bidder = display.find('.id-' + params.bidder);

					animate_push (function (complete)
					{
						bidder.addClass('error');
						bidder.find('.info').text('Error: ' + (errors[params.reason] || params.reason));

						complete();
					});

					break;

				case 'bid_filter':
					bidder = display.find('.id-' + params.bidder);

					animate_push (function (complete)
					{
						bidder.addClass('filter');
						bidder.find('.info').text('Filtered');

						complete();
					});

					break;

				case 'bid_pass':
					bidder = display.find('.id-' + params.bidder);

					animate_push (function (complete)
					{
						bidder.addClass('error');
						bidder.find('.info').text('Pass');

						complete();
					});

					break;

				case 'bid_valid':
					bidder = display.find('.id-' + params.bidder);

					animate_push(function (complete)
					{
						var index;

						bidder.addClass('valid');
						bidder.find('.info').text('Bid price: $' + params.price.toFixed(2));

						index = bidder.index();

						if (index > 0)
							swap_bidders(display, index, complete);
						else
							complete();
					});

					break;

				case 'end':
					if (params.winner === undefined)
					{
						creative.css('visibility', 'visible');

						break;
					}

					bidder = display.find('.id-' + params.winner);

					animate_push(function (complete)
					{
						var index;

						bidder.addClass('winner');
						bidder.find('.info').text(bidder.find('.info').text() + ' ; Paid price: $' + params.price.toFixed(2));

						index = bidder.index();

						if (index > 0)
							swap_bidders(display, index, complete);
						else
							complete();

						creative.css('visibility', 'visible');
					});

					break;

				case 'exclude':
					bidder = display.find('.id-' + params.bidder);

					animate_push(function (complete)
					{
						bidder.find('.info').text('Excluded: ' + params.reason);

						complete();
					});

					break;

				default:
					alert('Unexpected debug event type!');

					break;
			}
		});
	});
})(window);
