var Rainbow = require('rainbowvis.js');
var myRainbow = new Rainbow();
var $ = jQuery = require('jquery');
const parse = require('csv-parse');
var L = require('leaflet');
const districtsData = require('./districts114.json');

var district = "1";
var map = L.map('map', {
	scrollWheelZoom: true
});
var geojson;
var mode = 0;
var partisan = false;

// Set the starting position and zoom level of the map
// 40.7,-73.9 = NYC (lat, lon), 11 = a zoom level to see Manhattan
map.setView([40.194, -74.894], 8);

// Set up an event handler to fire while the map is dragging
map.on("drag", function () {
	update_status();
})

var valMap = [];
var months = {
	1: "January",
	2: "February",
	3: "March",
	4: "April",
	5: "May",
	6: "June",
	7: "July",
	8: "August",
	9: "September",
	10: "October",
	11: "November",
	12: "December"
}
for (let j = 2018; j < 2022; j++) {
	for (let i = 1; i < 13; i++) {
		valMap.push(`${months[i]} ${j}`)
	}
}

//updates a little status line at the bottom
function update_status() {
	var center = map.getCenter();
	var status = "";
	status += "Map: [" + Math.round(center.lat, 3) + ", " + Math.round(center.lng, 3) + "], z=" + map.getZoom();
	$("#status").html(status);
}

//an object that contains info about the specific data I am displaying
var myData = {
	csv: "VoterRegistration.csv",
}

function strToInt(val) {
	var s = val.replace(",", '');
	return parseInt(s);
}

function getColor(district) {
	myRainbow.setSpectrum('blue', 'purple', 'red');
	if (mode == 0) {
		let MData = findMonthData(district);
		if (!partisan) myRainbow.setNumberRange(0, strToInt(MData.total));
		if (partisan) myRainbow.setNumberRange(0, strToInt(MData.dem) + strToInt(MData.rep));
		return '#' + myRainbow.colorAt(strToInt(MData.rep));
	}
	else if (mode == 1) {
		let res = findCompareMonthData(district);
		if (res == null) {
			return "#808080"
		}
		let [m2, m1] = res;
		if (!partisan) {
			myRainbow.setSpectrum('green', "#FFBF00", 'red');
			myRainbow.setNumberRange(-10000, 10000);
			return '#' + myRainbow.colorAt(strToInt(m1.una) - strToInt(m2.una));
		}
		if (partisan) {
			var t = (strToInt(m1.dem) + strToInt(m1.rep)) - (strToInt(m2.dem) + strToInt(m2.rep));
			if (t < 0) myRainbow.setNumberRange(t, 0);
			if (t >= 0) myRainbow.setNumberRange(0, t);
		}
		return '#' + myRainbow.colorAt(strToInt(m1.rep) - strToInt(m2.rep));
	}
}

function style(feature) {
	return {
		weight: 2,
		opacity: 1,
		color: getColor(feature.properties.DISTRICT),
		dashArray: '3',
		fillOpacity: 0.7
	};
}

function findMonthData(district) {
	var full_date = $("#radiusAmount").val();
	var [month, year] = full_date.split(" ");
	month = month.toLowerCase();

	var temp = myData.data;
	for (i in temp) {
		if (temp[i].month == month && temp[i].year == year && temp[i].congressional_voting_district == district) {
			return temp[i];
		}
	}
	return null;
}

function findCompareMonthData(district) {
	var m1 = $("#filter_compare_month_one").val();
	var y1 = $("#filter_compare_year_one").val();
	var m2 = $("#filter_compare_month_two").val();
	var y2 = $("#filter_compare_year_two").val();

	if (m1 == m2 && y1 == y2) return null

	var res = [];

	var temp = myData.data;
	for (i in temp) {
		if ((temp[i].month == m1 && temp[i].year == y1 && temp[i].congressional_voting_district == district) || (temp[i].month == m2 && temp[i].year == y2 && temp[i].congressional_voting_district == district)) {
			res.push(temp[i]);
		}
	}
	return res;
}

function displayInfo(e) {
	if (e) {
		district = e.target.feature.properties.DISTRICT
	}
	var o = "";
	if (mode == 0) {
		let monthData = findMonthData(district);
		if (monthData.dem < 0 || monthData.rep < 0) {
			o += "No Data Found.";
		}
		else {
			o += "<b>District " + district + "</b><br><br>";
			o += "Dems: " + monthData.dem + "<br>";
			o += "Reps: " + monthData.rep + "<br><br>";
			if (!partisan) {
				o += "Conservative: " + monthData.cnv + "<br>";
				o += "U.S. Constitution Party: " + monthData.con + "<br>";
				o += "Green: " + monthData.gre + "<br>";
				o += "Libertarian: " + monthData.lib + "<br>";
				o += "Natural Law Party: " + monthData.nat + "<br>";
				o += "Reform Party: " + monthData.rfp + "<br>";
				o += "Socialist Party of New Jersey: " + monthData.ssp + "<br><br>";
				o += "Unaffliated: " + monthData.una + "<br><br>";
				o += `Total Registered Voters: ${monthData.total} <br><br>`;
			}
			else {
				o += "Total: " + (strToInt(monthData.dem) + strToInt(monthData.rep)).toLocaleString() + "<br><br>";
			}
		}
	}
	else if (mode == 1) {
		let res = findCompareMonthData(district);
		if (res == null) {
			o += "Two different months must be provided.";
		}
		else {
			let [m2, m1] = res;
			if (m1.dem < 0 || m1.rep < 0 || m2.dem < 0 || m2.rep < 0) {
				o += "No data found at least one of the provided months.";
			}
			else {
				o += "<b>District " + district + `<br> (Change from ${m2.month.toUpperCase()} ${m2.year} to ${m1.month.toUpperCase()} ${m1.year})` + "</b><br><br>";
				o += "Dems: " + (strToInt(m1.dem) - strToInt(m2.dem)).toString() + "<br>";
				o += "Reps: " + (strToInt(m1.rep) - strToInt(m2.rep)).toString() + "<br><br>";
				if (!partisan) {
					o += "Conservative: " + (strToInt(m1.cnv) - strToInt(m2.cnv)).toString() + "<br>";
					o += "U.S. Constitution Party: " + (strToInt(m1.con) - strToInt(m2.con)).toString() + "<br>";
					o += "Green: " + (strToInt(m1.gre) - strToInt(m2.gre)).toString() + "<br>";
					o += "Libertarian: " + (strToInt(m1.lib) - strToInt(m2.lib)).toString() + "<br>";
					o += "Natural Law Party: " + (strToInt(m1.nat) - strToInt(m2.nat)).toString() + "<br>";
					o += "Reform Party: " + (strToInt(m1.rfp) - strToInt(m2.rfp)).toString() + "<br>";
					o += "Socialist Party of New Jersey: " + (strToInt(m1.ssp) - strToInt(m2.ssp)).toString() + "<br><br>";
					o += "Unaffliated: " + (strToInt(m1.una) - strToInt(m2.una)).toString() + "<br><br>";
					o += `Total Registration Change: ${(strToInt(m1.total) - strToInt(m2.total)).toLocaleString()}`
				}
				else {
					o += `Registration Change: ${(strToInt(m1.rep) + strToInt(m1.dem) - (strToInt(m2.rep) + strToInt(m2.dem))).toLocaleString()}`
				}
			}
		}
	}
	$("#caption").html(o);
	if (e) zoomToFeature(e);
}


function highlightFeature(e) {
	var layer = e.target;

	layer.setStyle({
		weight: 5,
		color: '#666',
		dashArray: '',
		fillOpacity: 0.7
	});

	layer.bringToFront();
}

function resetHighlight(e) {
	geojson.resetStyle(e.target);
}

function zoomToFeature(e) {
	map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
	layer.on({
		mouseover: highlightFeature,
		mouseout: resetHighlight,
		click: displayInfo
	});
}

//function that updates the data
//if hard_update is false, will totally re-do the circles. use this for
//anything that might change which circles are displayed in the first place, 
//or might change their ordering.
//otherwise will try to modify the circles that exist
function update() {
	if ($('#compare').prop('checked')) {
		$('#one_month').hide();
		$('#compare_months').show();
		mode = 1;
	}
	else if ($('#single_month').prop('checked')) {
		$('#one_month').show();
		$('#compare_months').hide();
		mode = 0;
	}
	partisan = $('#partisan').prop('checked');
	$('#radiusAmount').val(valMap[$('#myRange').val()]);
	geojson.remove();
	displayInfo();
	geojson = L.geoJson(districtsData, {
		style: style,
		onEachFeature: onEachFeature
	}).addTo(map)
}

//shorthand way to avoid testing each property to see if it is a 
//function before returning the value
function v(property, data) {
	var obj = myData; //could change this
	if (typeof obj[property] == "function") {
		return obj[property](data);
	} else if (typeof obj[property] == "undefined") {
		return 0;
	} else {
		return obj[property];
	}
}

//stuff that is done once everything is loaded can go here

update_status(); //update the status bar

//set up the events for the UI elements
$("#filter_selection").on("change", function () {
	update();
})
$("#filter_single_month").on("change", function () {
	update();
})
$("#filter_single_year").on("change", function () {
	update();
})
$("#filter_compare_month_one").on("change", function () {
	update();
})
$("#filter_compare_year_one").on("change", function () {
	update();
})
$("#filter_compare_month_two").on("change", function () {
	update();
})
$("#filter_compare_year_two").on("change", function () {
	update();
})
$("#myRange").on("change", function () {
	update();
})
$("#partisan").on("change"), function () {
	updated();
}


//start downloading the data
$.get(myData.csv, function (csvString) {
	//got the CSV file as a string, now have to parse it
	parse.parse(csvString, { delimiter: ",", columns: true }, function (err, rows) {
		if (err) {
			alert("There was an error loading the data: " + err);
		} else {
			//show the data
			//preserve the initial index
			for (var i in rows) {
				rows[i].i = i;
			}

			myData.data = rows;

			//would be nice to know the maxes and mins of any value
			//only works for numbers in this implementation
			var max = []; var min = [];
			for (var i in Object.keys(rows[0])) {
				var key = Object.keys(rows[0])[i];
				max[key] = +rows[0][key];
				min[key] = +rows[0][key];
			}
			for (var i in rows) {
				for (var k in Object.keys(max)) {
					key = Object.keys(max)[k];
					if (+rows[i][key] > max[key]) max[key] = (+rows[i][key]);
					if (+rows[i][key] < min[key]) min[key] = (+rows[i][key]);
				}
			}
			myData.max = max;
			myData.min = min;

			var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			geojson = L.geoJson(districtsData, {
				style: style,
				onEachFeature: onEachFeature
			}).addTo(map);

			displayInfo();
		}
	})
})