mapboxgl.accessToken =
  "pk.eyJ1IjoiYmVzcGhpbGlwcyIsImEiOiJjbGd1ajU3am0xdWYzM3RtbXM2aG1qNms4In0.W7bqvnqLOxnaxtsIofn65g";

/**
 * Add the map to the page
 */

var origin = [6, 42, 30];
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/besphilips/clguj94uu003t01pg73wo7l6c", // style URL
  zoom: 2, // starting zoom
  center: origin,
});

map.addControl(new mapboxgl.NavigationControl());
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    // When active the map will receive updates to the device's location as it changes.
    trackUserLocation: true,
    // Draw an arrow next to the location dot to indicate which direction the device is heading.
    showUserHeading: true,
  })
);

function rotateCamera(timestamp) {
  // clamp the rotation between 0 -360 degrees
  // Divide timestamp by 100 to slow rotation to ~10 degrees / sec
  map.rotateTo((timestamp / 100) % 360, { duration: 0 });
  // Request the next frame of the animation.
  requestAnimationFrame(rotateCamera);
}

map.on("load", () => {
  /**
   * This is where your '.addLayer()' used to be, instead
   * add only the source without styling a layer
   */
  // Adding site footprint polygon

  map.loadImage("./assets/img/DLS_PhilipsShield_48_v2.png", (error, shield) => {
    if (error) throw error;

    map.addImage("shield", shield);
    map.addSource("location", {
      type: "geojson",
      data: "./assets/Geojson/Philips_Point_location.geojson",
    });
    map.addLayer({
      id: "sites",
      type: "symbol",
      source: "location",
      maxzoom: 14,
      layout: {
        "icon-image": "shield",
        "icon-size": 0.4,
        // "icon-translate-anchor": map
      },
    });
  });

  map.loadImage("./assets/img/growth.png", (error, idea) => {
    if (error) throw error;
    // Load an image from an external URL.
    map.addImage("idea", idea);
  });

  map.addSource("footprints", {
    type: "geojson",
    data: "./assets/Geojson/Philips_mappingUnits_v2.geojson",
  });

  map.addSource("landuse", {
    type: "geojson",
    data: "./assets/Geojson/Philips_locations_landuse.geojson",
  });

  map.addSource("buildings", {
    type: "geojson",
    data: "./assets/Geojson/Philips_buildings.geojson",
  });

  map.addSource("Perimeter", {
    type: "geojson",
    data: "./assets/Geojson/Philips_footprint_manufact.geojson",
  });

  map.addSource("Initiatives", {
    type: "geojson",
    data: "./assets/Geojson/Initiatives_point.geojson ",
  });

  map.addSource("Land Cover", {
    type: "raster",
    // use the tiles option to specify a WMS tile source URL
    // https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/
    tiles: [
      "https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage?bbox={bbox-epsg-3857}&&bboxSR=3857&width=256&height=256&srs=3857&time=&format=png32&pixelType=U8&f=Image",
      /// https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage?bbox=-2.00375070672E7%2C-1.554732375349997E7%2C2.0037507842788246E7%2C1.88420362465E7&bboxSR=3857&size=256&imageSR=3857&time=&format=png32&pixelType=U8&noData=&noDataInterpretation=esriNoDataMatchAny&interpolation=+RSP_BilinearInterpolation&compression=&compressionQuality=&bandIds=&sliceId=&mosaicRule=&renderingRule=&adjustAspectRatio=true&validateExtent=false&lercVersion=1&compressionTolerance=&f=Image
    ],
    tileSize: 256,
  });

  map.addSource("Intact Forest", {
    type: "vector",
    url: "mapbox://besphilips.8h0qufi4",
  });

  map.addSource("BII", {
    type: "raster",
    tiles: [
      "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsandBiotypes/Forest_Biodiversity_Intactness_Index/MapServer/export?bbox={bbox-epsg-3857}&&bboxSR=3857&width=256&height=256&srs=3857&time=&format=png32&pixelType=U8&f=Image&transparent=true",
    ],
  });

  map.addSource("WPA",{
    type: "raster",
    tiles:[
      'https://data-gis.unep-wcmc.org/server/rest/services/ProtectedSites/The_World_Database_of_Protected_Areas/MapServer/export?bbox={bbox-epsg-3857}&&bboxSR=3857&width=256&height=256&srs=3857&time=&format=png32&pixelType=U8&f=Image&transparent=true'
    ]
  });

  map.addSource("Satellite",{
    type: 'raster',
    url: 'mapbox://mapbox.satellite',
    tileSize: 256
  });

  map.addLayer({
    id: "Mapping Units",
    type: "fill",
    source: "footprints",
    paint: {
      "fill-color": [
        "match",
        ["get", "HabitatTyp"],
        "Bare Ground (soil/rock)",
        "#71635e",
        "Berm/Levee/Dike",
        '#002e5d',
        "Bioswale/Ecoroof/Detention Pond",
        "#6eaff3",
        "Brush/Scrub-Shrub",
        "#658f18",
        "Building/Structure",
        "#3887f0",
        'Cultivated/Cropland',
        '#fdd47b',
        "Drainage Ditch/Canal (Perennial)",
        "#00abec",
        "Forest",
        "#00863e",
        "Grassland/Herbaceous/Meadow",
        "#c2e393",
        "Gravel Area: Trail Road Staging Area Compacted Gravel",
        "#fdd47b",
        "Industrial District",
        "#791f31",
        "Landscaped Areas",
        "#5cbabc",
        "Mixed Forest/Grassland",
        "#65aa0a",
        "Other upland",
        "#a1dbbc",
        'Pasture/Range',
        '#c2e393',
        "Paved Area: Road Parking Lot",
        "#bbbec8",
        "Pond",
        "#6eaff3",
        "Wet Areas",
        "#5cbabc",


        "green", //fallback
      ],
      "fill-opacity": 1,
    },
  });

  map.addLayer({
    id: "Building",
    type: "fill-extrusion",
    source: "buildings",
    paint: {
      "fill-extrusion-height": ["get", "V_height"],
      "fill-extrusion-color": "#035ed8",
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.8,
    },
  });

  map.addLayer({
    id: "Perimeter",
    type: "line",
    source: "Perimeter",
    paint: {
      "line-color": "#439AC1",
      "line-width": 2,
    },
  });

  map.addLayer({
    id: "Initiatives",
    type: "symbol",
    source: "Initiatives",
    minzoom: 12,
    layout: {
      "icon-allow-overlap": true,
      "icon-anchor": "bottom",
      visibility: "visible",
      "icon-image": "idea",
      "icon-size": 0.15,
    },
  });

  map.addLayer({
    id: "Land cover",
    type: "raster",
    source: "Land Cover",
    paint: {},
    layout: {
      visibility: "none",
    },
  });

  map.addLayer({
    id: "Intact Forest",
    type: "fill",
    source: "Intact Forest",
    "source-layer": "IntactForest-cvk47b",
    paint: {
      "fill-color": "#86cb86",
    },
    layout: {
      visibility: "none",
    },
  });

  map.addLayer({
    id: "Biodiversity Intactness Index",
    type: "raster",
    source: "BII",
    paint: {
      "raster-opacity": 0.8,
    },
    layout: {
      visibility: "none",
    },
  });

  map.addLayer({
    id: "World Protected Areas",
    type: "raster",
    source: "WPA",
    paint:{
      "raster-opacity": 0.8,
    },
    layout: {
      visibility: "none"
    }
  });

  map.addLayer({
    id: "Satellite",
    type: "raster",
    source: "Satellite",
    paint:{
      "raster-opacity": 0.9,},
    layout:{
      visibility: "none"
    }
    });
  

  // Start the animation
});

// Initiatives pop up
map.on("click", "Initiatives", (e) => {
  const popup = new mapboxgl.Popup({ anchor: "top-left", offset: [20, 10] })
    .setLngLat(e.features[0].geometry.coordinates)
    .setHTML(
      `<div class="iniative"><h3>Initiative ${e.features[0].properties.Name}, ${e.features[0].properties.Site}</h3>
  <p>Description: ${e.features[0].properties.Description}</p>
  <img id='img_pop' src= './assets/img/${e.features[0].properties.img}.jpg'>
  <b>Ecosystem Services Provided: </b>
  <p>${e.features[0].properties.Ecosystem_Service}</p>
  <p>Current Status: ${e.features[0].properties.Implementation}</p></div>`
    )
    .addTo(map);
});

// Land use chart
map.on("click", "sites", (e) => {
  const data1 = JSON.parse(e.features[0].properties.Landuse);
  const keys = [
    "Bare Ground (soil | rock)",
    "Berm | Levee | Dike",
    "Bioswale | Ecoroof | Detention Pond",
    "Brush | Scrub-Shrub",
    "Building | Structure",
    "Cultivated | Cropland",
    "Drainage Ditch | Canal (Perennial)",
    "Forest",
    "Grassland | Herbaceous | Meadow",
    "Gravel Area: Trail Road Staging Area Compacted Gravel",
    "Industrial District",
    "Landscaped Areas",
    "Mixed Forest | Grassland",
    "Other upland",
    "Pasture | Range",
    "Paved Area: Road Parking Lot",
    "Pond",
    "Wet Areas"
  ];
  const colors = [
    "#71635e",
    '#002e5d',
    "#6eaff3",
    "#658f18",
    "#3887f0",
    '#fdd47b',
    "#00abec",
    "#00863e",
    "#c2e393",
    "#fdd47b",
    "#791f31",
    "#5cbabc",
    "#65aa0a",
    "#a1dbbc",
    "#c2e393",
    "#bbbec8",
    "#6eaff3",
    "#5cbabc",
  ];

  // Filter keys and data to exclude entries with value 0
  const filteredKeys = keys.filter((key) => data1[key] !== undefined);
  const filteredData = filteredKeys.map((key) => data1[key]);
  const filteredColors = filteredKeys.map((key) => colors[keys.indexOf(key)]);


  const chartData = {
    labels: filteredKeys,
    datasets: [
      {
        data: filteredData,
        backgroundColor: filteredColors,
        hoverBackgroundColor: "#0099ff",
      },
    ],
  };

  const popup = new mapboxgl.Popup({ offset: [0, 0] })
    .setLngLat(e.features[0].geometry.coordinates)
    .setHTML(
      `<h3>${e.features[0].properties.Site_Name}</h3><p>${e.features[0].properties.Country}</p>
      <div style="widht: 200px"><canvas id="chart"></canvas></div>`
    )
    .addTo(map);

  // Create the pie chart
  const ctx = document.getElementById("chart").getContext("2d");
  new Chart(ctx, {
    type: "pie",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: {
              family: "Neue Frutiger", // Specify the desired font type here
              size: 14, // Specify the font size if needed
            },
            textWidth: 150, // Set a maximum width for the legend labels
            usePointStyle: true, // Use point style markers for the legend labels
            generateLabels: function (chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const total = data.datasets[0].data.reduce(
                    (a, b) => a + b,
                    0
                  );
                  const percentage = Math.round((value / total) * 100);
                  return {
                    text: `${label}: ${(Math.round(value/10)*10).toLocaleString('de-DE')} sqm (${percentage}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden:
                      isNaN(data.datasets[0].data[i]) ||
                      chart.getDatasetMeta(0).data[i].hidden,
                    index: i,
                  };
                });
              }
              return [];
            },
          },
        },
      },
    },
  });

  map.flyTo({
    center: e.features[0].geometry.coordinates,
    zoom: 16,
    pitch: 60,
    bearing: -60,
  }); // Start the animation.
});

// Map units pop up
map.on("click", "Mapping Units", (e) => {
  const data1 = e.features[0].properties;
  // Specify the keys and values you want to include in the chart
  const selectedKeys = [
    "Noise",
    "Visual",
    "Air Quality, Nitrogen Removal",
    "Air Quality, Particle Removal",
    "Air Temperature Regulation",
    "Carbon Uptake",
    "Erosion Regulation",
    "Erosion Regulation Mass Wasting",
    "Water Provision",
    "Water Filtration",
    "Water Filtration, Nitrogen Removal",
    "Water Temperature Regulation",
    "Water Quantity Control",
  ]; // Replace with your desired keys
  const selectedValues = selectedKeys.map((key) => data1[key]);


  // Sort the keys and values
  const sortedData = selectedKeys
    .map((key, index) => ({
      key,
      value: selectedValues[index],
    }))
    .sort((a, b) => b.value - a.value);

  const sortedKeys = sortedData.map((data1) => data1.key);
  const sortedValues = sortedData.map((data1) => data1.value * 100);

  const chartData = {
    labels: sortedKeys,
    datasets: [
      {
        data: sortedValues,
        backgroundColor: [
          "#0073db",
          "#00abec",
          "#5cbabc",
          "#009d47",
          "#65aa0a",
          "#ffa505",
          "#fc9cc2",
          "#ec70be",
          "#a87bd8",
          // Add more colors as needed
        ],
        hoverBackgroundColor: "#0099ff",
      },
    ],
  };
  const popup = new mapboxgl.Popup({
    anchor: "bottom-right",
    // offset: [-40, 10],
    position: "fixed",
    bottom: 0,
  })

    .setLngLat(e.lngLat)
    .setHTML(
      `<h3>${e.features[0].properties.Name}</h3>
            <h4> Landuse: ${e.features[0].properties.HabitatTyp}
              </h4>
            <p> Area:  ${new Intl.NumberFormat("en-UK", {
              maximumSignificantDigits: 4,
            }).format(e.features[0].properties.Area_m2)} sqm
              </p><b>Unit Performance: </b>
              <div style="height: 500px"><canvas id="chart"></canvas></div>`
    )
    .addTo(map);

  // Create the bar chart
  const ctx = document.getElementById("chart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: {
              family: "Neue Frutiger", // Specify the desired font type here
              size: 12, // Specify the font size if needed
            },
            textWidth: 150, // Set a maximum width for the legend labels
            usePointStyle: true, // Use point style markers for the legend labels
            generateLabels: function (chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const total = data.datasets[0].data.reduce(
                    (a, b) => a + b,
                    0
                  );
                  const percentage = ((value / total) * 100).toFixed(0);
                  return {
                    text: `${label}: ${value.toFixed(0)}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden:
                      isNaN(data.datasets[0].data[i]) ||
                      chart.getDatasetMeta(0).data[i].hidden,
                    index: i,
                  };
                });
              }
              return [];
            },
          },
        },
      },
    },
  });
});

// Biomes pop up
map.on("click", (event) => {
  const biomes = map.queryRenderedFeatures(event.point, {
    layers: ["Biodiversity Hotspots"],
  });

  const biome = biomes[0];

  const popup = new mapboxgl.Popup({
    anchor: "bottom-right",
    offset: [-20, -30],
  })
    .setLngLat(event.lngLat)
    .setHTML(
      `<h3 class="Biome">Biomes Hotspot Area</h3><h4>${biome.properties.NAME}</h4>`
    )
    .addTo(map);
});

// Change the cursor to a pointer when the mouse is over the places layer.
map.on("mouseenter", "places", () => {
  map.getCanvas().style.cursor = "pointer";
});

// Change it back to a pointer when it leaves.
map.on("mouseleave", "places", () => {
  map.getCanvas().style.cursor = "";
});

map.on("mouseenter", "Biodiversity Hotspots", () => {
  map.getCanvas().style.cursor = "pointer";
});

// Change it back to a pointer when it leaves.
map.on("mouseleave", "Biodiversity Hotspots", () => {
  map.getCanvas().style.cursor = "";
});

// Change the cursor to a pointer when the mouse is over the places layer.
map.on("mouseenter", "Mapping Units", () => {
  map.getCanvas().style.cursor = "pointer";
});

// Change it back to a pointer when it leaves.
map.on("mouseleave", "Mapping Units", () => {
  map.getCanvas().style.cursor = "";
});

// Zoom to initial state
document.getElementById("zoom").addEventListener("click", () => {
  map.flyTo({
    center: [10, 45],
    zoom: 4,
    duration: 5,
    bearing: 0,
    pitch: 0,
  });
  var link = document.getElementById("popup");
  link.style.visibility = "hidden";
  //close all popup

  const popupz = document.getElementsByClassName("mapboxgl-popup");
  if (popupz.length) {
    popupz[0].remove();
  }
});

// After the last frame rendered before the map enters an "idle" state.
map.on("idle", () => {
  // If these two layers were not added to the map, abort
  if (!map.getLayer("Biodiversity Hotspots") || !map.getLayer("Initiatives")) {
    return;
  }

  // Enumerate ids of the layers.
  const toggleableLayerIds = [
    "Initiatives",
    "Mapping Units",
    "Biodiversity Hotspots",
    "Intact Forest",
    "Land cover",
    "Biodiversity Intactness Index",
    "World Protected Areas",
    "Satellite"
  ];

  // Set up the corresponding toggle button for each layer.
  for (const id of toggleableLayerIds) {
    // Skip layers that already have a button set up.
    if (document.getElementById(id)) {
      continue;
    }

    // Create a link.
    const link = document.createElement("a");
    link.id = id;
    link.href = "#";
    link.class = "layers_select";
    link.textContent = id;
    link.className =
      id === "Intact Forest" ||
      id === "Land cover" ||
      id === "Biodiversity Intactness Index" ||
      id === "World Protected Areas" ||
      id === "Satellite"
        ? "inactive"
        : "active";

    // Show or hide layer when the toggle is clicked.
    link.onclick = function (e) {
      const clickedLayer = this.textContent;

      const visibility = map.getLayoutProperty(clickedLayer, "visibility");

      // Toggle layer visibility by changing the layout object's visibility property.
      if (visibility === "visible") {
        map.setLayoutProperty(clickedLayer, "visibility", "none");
        this.className = "inactive";
        hideLegend(clickedLayer);
      } else {
        this.className = "active";
        map.setLayoutProperty(clickedLayer, "visibility", "visible");
        showLegend(clickedLayer);
      }
    };

    const layers = document.getElementById("menu");
    layers.appendChild(link);
  }

  // Function to show the legend based on the layer
  function showLegend(layer) {
    // Show the legend for the specified layer
    // You can customize this logic to display the appropriate legend content
    if (layer === "Biodiversity Hotspots") {
      document.getElementById("legend-biodiversity").style.display = "flex";
    } else if (layer === "Initiatives") {
      document.getElementById("legend-initiatives").style.display = "flex";
    } else if (layer === "Land cover") {
      document.getElementById("legend-land").style.display = "flex";
    } else if (layer === "Intact Forest") {
      document.getElementById("legend-intact").style.display = "flex";
    } else if (layer === "Biodiversity Intactness Index") {
      document.getElementById("legend-BII").style.display = "flex";
    }
    // Add more conditions for other layers if needed
  }

  // Function to hide the legend based on the layer
  function hideLegend(layer) {
    // Hide the legend for the specified layer
    // You can customize this logic to hide the appropriate legend content
    if (layer === "Biodiversity Hotspots") {
      document.getElementById("legend-biodiversity").style.display = "none";
    } else if (layer === "Initiatives") {
      document.getElementById("legend-initiatives").style.display = "none";
    } else if (layer === "Land cover") {
      document.getElementById("legend-land").style.display = "none";
    } else if (layer === "Intact Forest") {
      document.getElementById("legend-intact").style.display = "none";
    } else if (layer === "Biodiversity Intactness Index") {
      document.getElementById("legend-BII").style.display = "none";
    }
    // Add more conditions for other layers if needed
  }
});

const menuHead = document.getElementById("menu__head");
const menu = document.getElementById("menu");

menuHead.addEventListener("click", function () {
  menu.classList.toggle("collapsed");
});
