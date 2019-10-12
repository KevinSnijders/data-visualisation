(function () {
	var slice = [].slice;

	function queue(parallelism) {
		var q,
			tasks = [],
			started = 0, // number of tasks that have been started (and perhaps finished)
			active = 0, // number of tasks currently being executed (started but not finished)
			remaining = 0, // number of tasks not yet finished
			popping, // inside a synchronous task callback?
			error = null,
			await = noop,
			all;

		if (!parallelism) parallelism = Infinity;

		function pop() {
			while (popping = started < tasks.length && active < parallelism) {
				var i = started++,
					t = tasks[i],
					a = slice.call(t, 1);
				a.push(callback(i));
				++active;
				t[0].apply(null, a);
			}
		}

		function callback(i) {
			return function (e, r) {
				--active;
				if (error != null) return;
				if (e != null) {
					error = e; // ignore new tasks and squelch active callbacks
					started = remaining = NaN; // stop queued tasks from starting
					notify();
				} else {
					tasks[i] = r;
					if (--remaining) popping || pop();
					else notify();
				}
			};
		}

		function notify() {
			if (error != null) await(error);
			else if (all) await(error, tasks);
			else await.apply(null, [error].concat(tasks));
		}

		return q = {
			defer: function () {
				if (!error) {
					tasks.push(arguments);
					++remaining;
					pop();
				}
				return q;
			},
			await: function (f) {
				await = f;
				all = false;
				if (!remaining) notify();
				return q;
			},
			awaitAll: function (f) {
				await = f;
				all = true;
				if (!remaining) notify();
				return q;
			}
		};
	}

	function noop() {
	}

	queue.version = "1.0.7";
	if (typeof define === "function" && define.amd) define(function () {
		return queue;
	});
	else if (typeof module === "object" && module.exports) module.exports = queue;
	else this.queue = queue;
})();


queue();

d3.csv('csv/dataAjax.csv', function (dataSet) {
	//var dataSet = apiData;
	var dateFormat = d3.time.format("%Y-%m-%d %H:%M:%S.%L");
	dataSet.forEach(function (d) {
		d.datetime = dateFormat.parse(d.datetime);
		d.datetime.setDate(1);
	});


	//Create a Crossfilter instance
	var filter = crossfilter(dataSet);

	//Define Dimensions
	var datetime = filter.dimension(function (d) {
		return d.datetime;
	});
	var lostPoints = filter.dimension(function (d) {
		return d.lostPoints < 1 ? 'Nee' : 'Ja';
	});
	var competition = filter.dimension(function (d) {
		return d.competition;
	});
	var location = filter.dimension(function (d) {
		return parseInt(d.location) > 0 ? 'Thuis' : 'Uit';
	});
	var points = filter.dimension(function (d) {
		return d.points;
	});
	var match = filter.dimension(function (d) {
		return d.match;
	});

	//Calculate metrics
	var groupByDateTime = datetime.group();
	var groupByLostPoints = lostPoints.group();
	var groupByCompetition = competition.group();
	var groupByLocation = location.group();
	var groupByPoints = points.group();
	var groupByMatch = match.group();
	var groupByAll = filter.groupAll();

	var sumTotalPoints = filter.groupAll().reduceSum(function (d) {
		return d.points;
	});

	//Define threshold values for data
	var firstDate = datetime.bottom(1)[0].datetime;
	var lastDate = datetime.top(1)[0].datetime;

	//Charts
	var chartMatches = dc.barChart(".chart__matches");
	var chartDateTime = dc.lineChart(".chart__date-time");
	var chartCompetition = dc.rowChart(".chart__competition");
	var chartLocation = dc.pieChart(".chart__location");
	var chartLostPoints = dc.barChart(".chart__lost-points");
	var chartPoints = dc.rowChart(".chart__points");
	var totalMatches = dc.numberDisplay(".filter__matches");
	var totalPoints = dc.numberDisplay(".filter__points");

	// colors
	var ajaxPrimaryColor = '#c90e35';
	var firstColor = '#fb5f6c';
	var secondColor = '#f6c83f';
	var thirdColor = '#5c8eff';
	var fourthColor = '#255D9F';

	selectField = dc.selectMenu('.filter__team')
		.dimension(match)
		.group(groupByMatch);

	totalMatches
		.formatNumber(d3.format("d"))
		.valueAccessor(function (d) {
			return d;
		})
		.group(groupByAll);

	totalPoints
		.formatNumber(d3.format("d"))
		.valueAccessor(function (d) {
			return d;
		})
		.group(sumTotalPoints);

	dc.dataCount(".filter__records")
		.dimension(filter)
		.group(groupByAll);

	chartDateTime
		.height(250)
		.dimension(datetime)
		.group(groupByDateTime)
		.margins({top: 25, right: 35, bottom: 50, left: 60})
		.renderArea(true)
		.transitionDuration(1000)
		.x(d3.time.scale().domain([firstDate, lastDate]))
		.colors(d3.scale.ordinal().range([ajaxPrimaryColor]))
		.elasticY(true)
		.renderHorizontalGridLines(true)
		.renderVerticalGridLines(true)
		//.xAxisLabel("Periode")
		.yAxis().ticks(4);


	chartMatches
		.height(375)
		.transitionDuration(1000)
		.dimension(match)
		.group(groupByMatch)
		.margins({top: 25, right: 35, bottom: 115, left: 60})
		.centerBar(true)
		.gap(5)
		.elasticY(true)
		.x(d3.scale.ordinal().domain(datetime))
		.y(d3.scale.ordinal().domain(datetime))
		.xUnits(dc.units.ordinal)
		.renderHorizontalGridLines(true)
		.renderVerticalGridLines(true)
		//.yAxisLabel("Aantal wedstrijden")
		.colors(d3.scale.ordinal().range([ajaxPrimaryColor]))
		.yAxis().ticks(6);

	chartCompetition
		.height(250)
		.dimension(competition)
		.group(groupByCompetition)
		.margins({top: 25, right: 35, bottom: 50, left: 60})
		.elasticX(true)
		.colors(d3.scale.ordinal().domain(["Champions League", "Eredivisie", "Europa League", "Johan Cruijff Schaal", "KNVB"])
			.range([firstColor, secondColor, thirdColor, ajaxPrimaryColor, fourthColor]))
		.colorAccessor(function (d) {
			switch (d.key) {
				case 'Champions League':
					return 'Champions League';
				case 'Eredivisie':
					return 'Eredivisie';
				case 'Europa League':
					return 'Europa League';
				case 'Johan Cruijff Schaal':
					return 'Johan Cruijff Schaal';
				default:
					return 'KNVB'
			}
		})
		.xAxis().ticks(8);

	chartPoints
		.height(220)
		.dimension(points)
		.group(groupByPoints)
		.margins({top: 25, right: 35, bottom: 50, left: 60})
		.colors(d3.scale.ordinal().domain(["lose", "draw", "win"])
			.range([firstColor, secondColor, thirdColor]))
		.colorAccessor(function (d) {
			if (d.key === '0')
				return 'lose';
			else if (d.key === '1')
				return 'draw';
			return 'win';
		})
		.xAxis().ticks(4);

	chartLostPoints
		.height(220)
		.dimension(lostPoints)
		.group(groupByLostPoints)
		.margins({top: 25, right: 35, bottom: 50, left: 60})
		.gap(32)
		.elasticY(true)
		.x(d3.scale.ordinal().domain(datetime))
		.y(d3.scale.ordinal().domain(datetime))
		//.xUnits(10)
		.xUnits(dc.units.ordinal)
		.renderHorizontalGridLines(true)
		.renderVerticalGridLines(true)
		.colors(d3.scale.ordinal().domain(["Nee", "Ja"])
			.range([firstColor, thirdColor]))
		.colorAccessor(function (d) {
			if (d.key === 'Nee')
				return 'Nee';
			return 'Ja';
		})
		.xAxis().ticks(4);


	chartLocation
		.height(220)
		.radius(90)
		.innerRadius(40)
		.transitionDuration(1000)
		.colors(d3.scale.ordinal().domain(["Thuis", "Uit"])
			.range([ajaxPrimaryColor, "#050505"]))
		.colorAccessor(function (d) {
			if (d.key === 'Thuis')
				return 'Thuis';
			return 'Uit';
		})
		.ordering(function (d) {
			return +d.value
		})
		.dimension(location)
		.group(groupByLocation);

	// Render all the charts
	dc.renderAll();
});