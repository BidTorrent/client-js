
/*
** Basic implementation of Future/Promise asynchronous pattern.
*/
var Future = function ()
{
	this.arguments = undefined;
	this.complete = undefined;
};

/*
** Synchronize multiple future instances into a single future object exposing
** values of all wrapped futures on completion.
** Usage:
**     Future.bind(future1, future2, ...)
** Example:
**     Future
**        .bind(future1, future2, future3)
**        .then(function(values1, values2, values3)
**        {
**            console.log(values1[0]); // 1st value of future1
**            console.log(values2[0]); // 2st value of future2
**        });
*/
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

/*
** Create a future that watches multiple child futures and completes with value
** of the first completed one.
** Usage:
**     Future.first(future1, future2, ...)
** Example:
**     Future
**        .first(future1, future2, future3)
**        .then(function(value)
**        {
**            console.log(value); // 1st value of first completed future
**        });
*/
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

/*
** Create a future already completed with given values.
** Usage:
**     Future.make(value1, value2, ...)
*/
Future.make = function ()
{
	var future;

	future = new Future();
	future.signal.apply(future, arguments);

	return future;
};

/*
** Register conversion lambda on future instance, conversion will be performed
** when parent future completes. Lambda expects parent future values and must
** return an array of values for child future instance.
** Usage:
**    future.chain(function(value1, value2, ...) { return [value1 * 2, value2 * 0.5]; });
*/
Future.prototype.chain = function (lambda)
{
	var future = new Future();

	this.then(function ()
	{
		future.signal.apply(future, lambda.apply(null, arguments));
	});

	return future;
};

/*
** Complete future instance with given values. A future instance can only be
** completed once, subsequent calls will be ignored.
** Usage:
**    future.signal(value1, value2, ...);
*/
Future.prototype.signal = function ()
{
	if (this.arguments !== undefined)
		return false;

	this.arguments = arguments;

	if (this.complete !== undefined)
		this.complete.apply(null, arguments);

	return true;
};

/*
** Register completion action on future instance. Completion action will be
** invoked with future values when it completes (can lead to synchronous call).
** Usage:
**    future.then(function(value1, value2, ...) { ... });
*/
Future.prototype.then = function (complete)
{
	if (this.arguments !== undefined)
		complete.apply(null, this.arguments);
	else
		this.complete = complete;
};

// Module exports
exports.Future = Future;
