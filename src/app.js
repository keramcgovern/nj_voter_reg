// Initialize Jquery on our window
var $ = jQuery = require('jquery');

// CSV parser
const parse = require('csv-parse');

// Initialize leaflet.js
var L = require('leaflet');

const districtCoords = {
	1:[39.777820246766645, -75.04968499362114],
	2:[39.45262837055235, -74.89715640108363],
	3:[39.870735214023505, -74.52817140049724],
	4:[40.16786384054729, -74.26589156502571],
	5:[40.913513358835594, -74.51684450176056],
	6:[40.48871045319269, -74.15459604868919],
	7:[40.65679652356134, -74.7435698222786],
	8:[40.72299688047879, -74.11661288585557],
	9:[40.85777195407002, -74.04916744107621],
	10:[40.729406508147186, -74.18617842653319],
	11:[40.89042268203383, -74.42626085332499],
	12:[40.382999273519935, -74.5388554503266]
}

// Initialize the map
var map = L.map('map', {
	scrollWheelZoom: false
});

// Initialize globals
var circles = []; //an array for our circles

// Set the starting position and zoom level of the map
// 40.7,-73.9 = NYC (lat, lon), 11 = a zoom level to see Manhattan
map.setView([40.194, -74.894], 8);

// Initialize the base layer of OpenStreetMaps
/*var osm_mapnik = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; OSM Mapnik <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);*/

var layers = {
	street: "m",
	satellite: "s",
	hybrid: "s,h",
	terrain: "p",
	lightroads: "r",
	justroads: "h"
}

// I have no idea what the usage policy is for these kinds of tiles from Google. Seems to work..?
var gmap_tiles = L.tileLayer('http://{s}.google.com/vt/lyrs=' + layers.lightroads + '&x={x}&y={y}&z={z}', {
	maxZoom: 20,
	opacity: 0.5,
	subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
}).addTo(map);

// Set up an event handler to fire while the map is dragging
map.on("drag", function () {
	update_status();
})

//updates a little status line at the bottom
function update_status() {
	var center = map.getCenter();
	var status = "";
	status += "Map: [" + Math.round(center.lat, 3) + ", " + Math.round(center.lng, 3) + "], z=" + map.getZoom();
	$("#status").html(status);
}

//an object that contains info about the specific data I am displaying
var myData = {
	//the CSV file with the data 
	csv: "NYC_Pool_Inspections.csv",

	//function that returns the latitude and longtiude of the data as an array
	latLng: function (d) { return [+d.lat, +d.long] },

	//function that produces an array that tells it how to display in the locator control
	locator: function () {

		var data = [...myData.data]; //copy the data
		data.sort(function (a, b) { //sort by name
			if (a.name > b.name) return 1;
			if (a.name < b.name) return -1;
			return 0;
		})
		//create new array of just the index and the name
		var locator = [];
		var bo_option = $("#filter_bo").val();
		var pool_type = $("#filter_pool_type").val();
		for (var i in data) {
			if (!bo_option && !pool_type) locator.push([data[i].i, data[i].name, data[i].inspection_date]);
			if (!pool_type && bo_option && data[i].bo.toLowerCase() == bo_option) locator.push([data[i].i, data[i].name, data[i].inspection_date]);
			if (pool_type && data[i].permit_type.toLowerCase() == pool_type && !bo_option) locator.push([data[i].i, data[i].name, data[i].inspection_date]);
			if (pool_type && data[i].permit_type.toLowerCase() == pool_type && bo_option && data[i].bo.toLowerCase() == bo_option) locator.push([data[i].i, data[i].name, data[i].inspection_date]);
		}

		var opts = '<option value=""/>';
		for (var i in locator) {
			opts += '<option value="' + locator[i][0] + '">' + locator[i][2] + ' - ' + locator[i][1] + '</option>';
		}
		$("#locator").html(opts);

		return locator;
	},

	//function called when something is selected on the locator
	//gets the index of the data object, or blank if none selected 
	locate: function (data_index) {
		if (data_index == "") {
			$("#caption").html("");
			for (var i in circles) {
				var d = circles[i].options.d;
				circles[i]._path.classList.remove("selected");
			}
		} else {
			myData.caption(myData.data[data_index]);
			for (var i in circles) {
				if (circles[i].options.d.i == data_index) {
					circles[i]._path.classList.add("selected");
				} else {
					circles[i]._path.classList.remove("selected");
				}
			}
		}
	},

	//radius of the circle (in pixels)
	radius: function (d) {
		return d.all_violations * 5;
	},

	//changes the fill color 
	fillColor: function (d) {
		if (+d.phh_violations > 0) return 'rgb(175, 0, 0)';
		if (+d.critical_violations > 0) return 'rgb(255, 143, 0)';
		if (+d.general_violations > 0) return 'rgb(255, 236, 0)';
	},

	//could set the stroke color separately,
	//but here I'm just making it copy the fillColor
	strokeColor: function (d) {
		return v("fillColor", d)
	},

	//some other basic properties
	fillOpacity: 0.2,
	strokeOpacity: 0.7,
	strokeWeight: 0.9,

	//what happens when the mouse pointer goes over a circle
	mouseover: function (d, svg) {
		svg.classList.add("hover");
	},

	//what happens when the mouse pointer leaves a circle
	mouseout: function (d, svg) {
		svg.classList.remove("hover");
	},

	//class assigned to all circles
	class: "circle",

	//what happens when a circle is clicked
	caption: function (d) {
		var o = "";
		o += "<b>" + d.name + "</b><br>";
		o += d.address_no + " " + d.address_st + "<br>"; //,address_no,address_st,bo,zip,
		o += "Inspection Date: " + d.inspection_date + "<br>";
		o += "Inspection Type: " + d.inspection_type + "<br>";
		o += "<br> All Violations: " + d.all_violations + "<br>";
		o += "Public Health Hazards: " + d.phh_violations + "<br>";
		o += "Critical: " + d.critical_violations + "<br>";
		o += "General: " + d.general_violations + "<br>";
		$("#caption").html(o);
	},


	show: function (d) {

		let pool_type = true;
		let bo = true;
		let phh = false;
		let gen = false;
		let crit = false;
		let y19 = false;
		let y20 = false;
		let y21 = false;

		let map_options = {
			"ma": [[40.744, -73.985], 13],
			"bk": [[40.65, -73.936], 12],
			"qu": [[40.741, -73.845], 12],
			"bx": [[40.854, -73.887], 13],
			"si": [[40.581, -74.167], 12],
		}

		var type_option = $("#filter_pool_type").val();
		if (!type_option) pool_type = true;
		else if (type_option == d.permit_type.toLowerCase()) {
			pool_type = true;
		} else {
			pool_type = false;
		}

		var bo_option = $("#filter_bo").val();
		if (!bo_option) bo = true;
		else if (bo_option == d.bo.toLowerCase()) {
			bo = true;
			map.setView(map_options[bo_option][0], map_options[bo_option][1]);
		} else {
			bo = false;
		}

		if ($("#phh").prop('checked') && +d.phh_violations > 0) phh = true;
		if ($("#general").prop('checked') && +d.general_violations > 0) gen = true;
		if ($("#critical").prop('checked') && +d.critical_violations > 0) crit = true;

		if ($("#2019").prop('checked') && +d.inspection_year == 2019) y19 = true;
		if ($("#2020").prop('checked') && +d.inspection_year == 2020) y20 = true;
		if ($("#2021").prop('checked') && +d.inspection_year == 2021) y21 = true;

		return pool_type && bo && (phh || gen || crit) && (y19 || y20 || y21);
	},

}


//function that displays the data
function show_data() {
	if (circles.length) {
		for (var i in circles) {
			circles[i].remove();
		}
	}

	//sort it so that smaller circles end up on top
	//uses the radius provided by myData

	//make a copy of the data so we can sort it
	myData.displayData = [...myData.data];
	var data = myData.displayData;

	data.sort(function (a, b) {
		if (v("radius", a) > v("radius", b)) return -1;
		if (v("radius", a) < v("radius", b)) return 1;
		return 0;
	})
	for (let i = 1; i < 13; i++) {
		var d = data[i];
		var icon = L.icon({
			iconUrl: `/lib/images/district_${i}.png`,
			iconSize: [330, 570], // size of the icon
			iconAnchor: [142, 275], // point of the icon which will correspond to marker's location
		});
		circles.push(L.marker(districtCoords[i], { icon: icon, i:i,
			className: v("class", d) + " " + (v("show", d, true) == true ? "" : "hidden")})
		.addTo(map)
		.on("click", function () { //when the user clicks on a circle
			var element = this._path;
			for (var i in circles) {
				if (circles[i].options.d.i == this.options.d.i) {
					circles[i]._path.classList.add("selected");
				} else {
					circles[i]._path.classList.remove("selected");
				}
			}
			if (typeof myData.caption == "function") {
				myData.caption.call(this, this.options.d, element);
			}
		})
		.on("mouseover", function () { //when the user hovers over a circle
			var element = this._path;
			if (typeof myData.mouseover == "function") {
				myData.mouseover.call(this, this.options.d, element);
			}
		})
		.on("mouseout", function () { //when the user stops hovering
			var element = this._path;
			if (typeof myData.mouseout == "function") {
				myData.mouseout.call(this, this.options.d, element);
			}
		})
		);
	}

	/* for (var i in data) {
		var d = data[i];
		//we set all of the style properties based on the myData object above.
		circles.push(
			L.circleMarker(myData.latLng(d), {
				radius: v("radius", d),
				weight: v("strokeWeight", d),
				color: v("strokeColor", d),
				fillColor: v("fillColor", d),
				opacity: v("strokeOpacity", d),
				fillOpacity: v("fillOpacity", d),
				className: v("class", d) + " " + (v("show", d, true) == true ? "" : "hidden"),
				i: i, //the circles' index 
				d: d //the data linked to the circle
			})
				.addTo(map)
				.on("click", function () { //when the user clicks on a circle
					var element = this._path;
					for (var i in circles) {
						if (circles[i].options.d.i == this.options.d.i) {
							circles[i]._path.classList.add("selected");
						} else {
							circles[i]._path.classList.remove("selected");
						}
					}
					if (typeof myData.caption == "function") {
						myData.caption.call(this, this.options.d, element);
					}
				})
				.on("mouseover", function () { //when the user hovers over a circle
					var element = this._path;
					if (typeof myData.mouseover == "function") {
						myData.mouseover.call(this, this.options.d, element);
					}
				})
				.on("mouseout", function () { //when the user stops hovering
					var element = this._path;
					if (typeof myData.mouseout == "function") {
						myData.mouseout.call(this, this.options.d, element);
					}
				})
		)
	} */

}

//function that updates the data
//if hard_update is false, will totally re-do the circles. use this for
//anything that might change which circles are displayed in the first place, 
//or might change their ordering.
//otherwise will try to modify the circles that exist
function update(hard_update = false) {
	if (!hard_update) {
		for (var i in circles) {
			var d = circles[i].options.d;
			circles[i].setStyle({
				radius: v("radius", d),
				weight: v("strokeWeight", d),
				color: v("strokeColor", d),
				fillColor: v("fillColor", d),
				opacity: v("strokeOpacity", d),
				fillOpacity: v("fillOpacity", d),
			})
			if (v("show", d, true) == true) {
				circles[i]._path.classList.remove("hidden");
			} else {
				circles[i]._path.classList.add("hidden");
			}
		}
		myData.locator();
	} else {
		show_data();
	}
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
$("#filter_pool_type").on("change", function () {
	update();
})
$("#filter_violations").on("change", function () {
	update();
})
$("#filter_bo").on("change", function () {
	update();
})

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

			//make the locator
			if ((typeof myData.locator == "function") && ($("#locator"))) {
				var l = myData.locator();
				$("#locator").on("change", function () {
					myData.locate($("#locator").val());
				})

			}
			show_data();
		}
	})
})
