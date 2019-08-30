(function() {
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
			return function(e, r) {
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
			defer: function() {
				if (!error) {
					tasks.push(arguments);
					++remaining;
					pop();
				}
				return q;
			},
			await: function(f) {
				await = f;
				all = false;
				if (!remaining) notify();
				return q;
			},
			awaitAll: function(f) {
				await = f;
				all = true;
				if (!remaining) notify();
				return q;
			}
		};
	}

	function noop() {}

	queue.version = "1.0.7";
	if (typeof define === "function" && define.amd) define(function() { return queue; });
	else if (typeof module === "object" && module.exports) module.exports = queue;
	else this.queue = queue;
})();


queue();

d3.csv('csv/dataAjax.csv', function (dataSet) {
	//var dataSet = apiData;
	var dateFormat = d3.time.format("%Y-%m-%d %H:%M:%S.%L");
	var timeFormat = d3.time.format("%H:%M");
	dataSet.forEach(function (d) {
		d.Recording_Datetime = dateFormat.parse(d.Recording_Datetime);
		d.Recording_Datetime.setDate(1);
	});

	//Create a Crossfilter instance
	var filter = crossfilter(dataSet);

	//Define Dimensions
	var Recording_Datetime = filter.dimension(function (d) {
		return d.Recording_Datetime;
	});
	var MatchDate = filter.dimension(function (d) {
		return dateFormat(d.Recording_Datetime);
	});
	var PuntenLatenLiggen = filter.dimension(function (d) {
		return d.PuntenLatenLiggen < 1 ? 'Nee' : 'ja';
	});
	var Competition = filter.dimension(function (d) {
		return d.Competition;
	});
	var Thuis_Uit = filter.dimension(function (d) {
		return d.thuis_uit > 0 ? 'thuis' : 'Uit';
	});
	var Punten = filter.dimension(function (d) {
		return d.punten;
	});
	var Wedstrijd = filter.dimension(function (d) {
		return d.Wedstrijd;
	});
	var match = filter.dimension(function (d) {
		return d.Wedstrijd;
	});
	var dateDimension = filter.dimension(function (d) {
		return d.Recording_Datetime
	});


	//Calculate metrics
	var projectsByDate = Recording_Datetime.group();
	var projectsByMatch = MatchDate.group();
	var projectsByLosedPoints = PuntenLatenLiggen.group();
	var projectsByCompetition = Competition.group();
	var projectsByThuis_Uit = Thuis_Uit.group();
	var projectsByPunten = Punten.group();
	var WedstrijdGroup = Wedstrijd.group();
	var matchGroup = match.group();
	var all = filter.groupAll();


	var sumTotalPoints = filter.groupAll().reduceSum(function (d) {
		return d.punten;
	});

	//Define threshold values for data
	var minDate = Recording_Datetime.bottom(1)[0].Recording_Datetime;
	var maxDate = Recording_Datetime.top(1)[0].Recording_Datetime;

	//Charts
	var wedstrijdChart = dc.barChart("#wedstrijd-chart");
	var dateChart = dc.lineChart("#date-chart");
	var CompetitionChart = dc.rowChart("#competition-chart");
	var Thuis_UitChart = dc.pieChart("#home-away-chart");
	var PuntenLatenLiggenChart = dc.rowChart("#losed-points-chart");
	var PuntenChart = dc.rowChart("#total-points-chart");
	var totalMatches = dc.numberDisplay(".filter__matches");
	var totalPoints = dc.numberDisplay(".filter__points");
	var table = dc.dataTable('.dc-data-table');


	selectField = dc.selectMenu('.filter__team')
		.dimension(Wedstrijd)
		.group(WedstrijdGroup);

	dc.dataCount(".filter__records")
		.dimension(filter)
		.group(all);


	totalMatches
		.formatNumber(d3.format("d"))
		.valueAccessor(function (d) {
			return d;
		})
		.group(all);

	totalPoints
		.formatNumber(d3.format("d"))
		.valueAccessor(function (d) {
			return d;
		})
		.group(sumTotalPoints);

	dateChart
	//.width(600)
		.height(220)
		.margins({top: 10, right: 50, bottom: 30, left: 50})
		.dimension(Recording_Datetime)
		.group(projectsByDate)
		.renderArea(true)
		.transitionDuration(500)
		.x(d3.time.scale().domain([minDate, maxDate]))
		.elasticY(true)
		.renderHorizontalGridLines(true)
		.renderVerticalGridLines(true)
		.xAxisLabel("Periode")
		.yAxis().ticks(6);


	wedstrijdChart
		.height(220)
		.transitionDuration(1000)
		.dimension(match)
		.group(matchGroup)
		.margins({top: 10, right: 50, bottom: 30, left: 50})
		.centerBar(false)
		.gap(5)
		.elasticY(true)
		.x(d3.scale.ordinal().domain(MatchDate))
		.y(d3.scale.ordinal().domain(MatchDate))
		.xUnits(dc.units.ordinal)
		.renderHorizontalGridLines(true)
		.renderVerticalGridLines(true)
		.yAxisLabel("Aantal wedstrijden")

		.yAxis().ticks(6);

	CompetitionChart
		.height(220)
		.dimension(Competition)
		.group(projectsByCompetition)
		.elasticX(true)
		.xAxis().ticks(5);

	PuntenChart
		.height(220)
		.dimension(Punten)
		.group(projectsByPunten)
		.xAxis().ticks(4);

	PuntenLatenLiggenChart
		.height(220)
		.dimension(PuntenLatenLiggen)
		.group(projectsByLosedPoints)
		.xAxis().ticks(4);


	Thuis_UitChart
		.height(220)
		.radius(90)
		.innerRadius(40)
		.transitionDuration(1000)
		.dimension(Thuis_Uit)
		.group(projectsByThuis_Uit);

	table
		.dimension(dateDimension)
		.group(function (d) {
			return d.Recording_Datetime.getFullYear();
		})
		.size(10)
		.columns([

			'Wedstrijd',
			{
				label: 'Thuis of uit',
				format: function (d) {
					return d.thuis_uit > 0 ? 'Thuis' : 'Uit';
				}
			},
			{
				label: 'Score Ajax',
				format: function (d) {
					return d.ScoreAjax;
				}
			},
			{
				label: 'Score tegen',
				format: function (d) {
					return d.ScoreTegen;
				}
			},
			'punten',
			'Competition',
			{
				label: 'Tijd',
				format: function (d) {
					return timeFormat(d.Recording_Datetime);
				}
			}
		]);
	dc.renderAll();
});