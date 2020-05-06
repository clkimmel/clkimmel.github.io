/*
| Copyright 2016 Esri
|
| Licensed under the Apache License, Version 2.0 (the "License");
| you may not use this file except in compliance with the License.
| You may obtain a copy of the License at
|
| http://www.apache.org/licenses/LICENSE-2.0
|
| Unless required by applicable law or agreed to in writing, software
| distributed under the License is distributed on an "AS IS" BASIS,
| WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
| See the License for the specific language governing permissions and
| limitations under the License.
*/
define(function() {

    return {

        app: {
            headerTitle: "Esri Campus Viewer",
            logoImage: "app/images/logo65-whiteontrans.png",
            headerLink: "http://www.esri.com"

        },

        //PORTAL URL
        portalUrl: 'https://indoorspoc.raleighnc.gov/portal/',

        //WEB SCENE ID
        webSceneId:  "573c9e402aea4e54ace7a376e86364ba",

        // PROXY
        // proxyUrlPrefix: "",
        // proxyUrl: "",


        //NAME FOR INTERIOR SPACES/ROOMS(TO IDENTIFY SPACES LAYER IN A GROUP LAYER)
        spaceLayerStringIdentifier: "UNIT_NAME",

        //FLOORPICKER
        floorPickerInfo: {
            1 :  {  buttonLabel: "-2", value: "B2 Basment"},
            2 :  {  buttonLabel: "-1", value: "B1 Basment"},
            3 :  {  buttonLabel: "1", value: "1st Floor"},
			4 :  {  buttonLabel: "2", value: "2nd Floor"}
        },

        //HERE, LAYER NAME IS THE NAME OF LAYER AS SEEN IN TOC OF SCENE VIEWER
        floorsLayers: {
          "all": [
                { layerName: "Floorplan Doors", floorNumberFld: "LEVEL_NAME", floorIDFld: "LEVEL_ID"},
                { layerName: "Floorplan Walls", floorNumberFld: "LEVEL_NAME", floorIDFld: "LEVEL_ID"},
                { layerName: "Places + Things", floorNumberFld: "LEVEL_NAME", floorIDFld: "LEVEL_ID"}
              ]
        },

        // FIELD SPECIFYING FLOOR NUMBER
        floorField: "LEVEL_NAME",

        // DEFAULT PLACEHOLDER FOR SEARCH WIDGET
        allSearchPlaceholder: "Find people or places",

        //SEARCH INFO
        searchInfo: {
            1 :  {
                    name: "Units",
                    dropdownSearch: {
                        placeholder: "Search for units",
                        queryUrl: "https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/3",
                        queryFields: ["SITE", "UNIT_NAME"],
                        suggestionTemplate: "{UNIT_NAME} ({USE_TYPE})"
                    },
                    outFields:["OBJECTID", "UNIT_NAME", "NAME", "LEVEL_NAME", "SITE", "FACILITY_NAME", "USE_TYPE", "LEVEL_ID" ],

                    // associated info (Instead of Related Tables)
                    associatedInfo: {
                      //url: "https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/29",
                      url: "https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/29",
                      outFields:["FACILITYID", "ASSET_TYPE", "MAKE"],
                      queryField: "FACILITYID",      // for this layer query
                      queryFieldType: "TEXT" ,    //or number
                      matchingQueryField: "SITE_ID",    // for the dropdownSearch layer
                    },

                    // INFO DISPLAYED IN SIDE PANEL
                    displayInfo: {
                        USE_TYPE: {class:"sp-info__subtitle", prefix:"", suffix:"" },
                        UNIT_NAME: {class:"sp-info__office" },
                        FACILITYID: {class: "sp-info__name"},
                        ASSET_TYPE: {class:"sp-info__email" },
                        MAKE: {class:"sp-info__desc", prefix:"ext. ", suffix:"" }
                    },

                    // TEXT TO IDENTIFY CORRESPONDING SCENE LAYERS
                    correspondingSceneLyrName: "Places + Things",

                    // SYMBOLOGY FOR SELECTED SPACE/ROOM
                    selectionRendering: {
                        // this field is used to get label info
                        rendererField: "UNIT_NAME",

                        color: [231, 76, 60],
                        symbol: "\ue61d", //esri-icon-map-pin https://developers.arcgis.com/javascript/latest/guide/esri-icon-font/index.html
                        symbolColor: "#7A003C",
                        symbolFont: {      // https://developers.arcgis.com/javascript/latest/api-reference/esri-symbols-Font.html
                                        size: 30,
                                        family: "CalciteWebCoreIcons"
                                      },

                        labelColor: "#7A003C",
                        labelFont: {
                                        size: 25,
                                        family: "sans-serif",
                                        weight: "bold"
                                      },
                        labelSymbolSpacing: "\n\n"

                    }
                },

            2 :  {
                    name: "Vertical Asset Electrical;",
                    dropdownSearch: {
                        placeholder: "Search for people",
                        //queryUrl: "https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/29",
                        queryUrl: "https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/29",
                        queryFields: ["SITE", "FACILITYID"],
                        suggestionTemplate: "{FACILITYID} ({SITE_ID})"
                    },
                    outFields:["OBJECTID", "SITE_ID", "FACILITY_NAME", "FACILITY_ID", "ASSET_TYPE", "MAKE" ],

                    // associated info (Instead of Related Tables)
                    associatedInfo: {
                      url: "https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/29",
                      outFields:["UNIT_NAME", "UNIT_ID", "LEVEL_NAME", "USE_TYPE", "LEVEL_ID"],
                      queryField: "FACILITYID",      // for this layer
                      queryFieldType: "TEXT" ,    //or number
                      matchingQueryField: "FACILITYID",    // for the dropdownSearch layer
                    },

                    // INFO DISPLAYED IN SIDE PANEL
                    displayInfo: {
                        USE_TYPE: {class:"sp-info__subtitle", prefix:"", suffix:"" },
                        UNIT_NAME: {class:"sp-info__office" },
                        FACILITYID: {class: "sp-info__name"},
                        ASSET_TYPE: {class:"sp-info__email" },
                        MAKE: {class:"sp-info__desc", prefix:"ext. ", suffix:"" }
                    },

                    // TEXT TO IDENTIFY CORRESPONDING SCENE LAYERS
                    correspondingSceneLyrName: "Places + Things",

                    // SYMBOLOGY FOR SELECTED SPACE/ROOM
                    selectionRendering: {
                        // this field is used to get label info
                        rendererField: "UNIT_NAME",

                        color: [231, 76, 60],
                        symbol: "\ue61d", //esri-icon-map-pin https://developers.arcgis.com/javascript/latest/guide/esri-icon-font/index.html
                        symbolColor: "#7A003C",
                        symbolFont: {      // https://developers.arcgis.com/javascript/latest/api-reference/esri-symbols-Font.html
                                        size: 30,
                                        family: "CalciteWebCoreIcons"
                                      },

                        labelColor: "#7A003C",
                        labelFont: {
                                        size: 25,
                                        family: "sans-serif",
                                        weight: "bold"
                                      },
                        labelSymbolSpacing: "\n\n"

                    }
                }
        },

        // HIGHLIGHT COLOR FOR SPACES
        defaultHighlight: {
            color: [0, 255, 255, 1],
            haloOpacity: 1,
            fillOpacity: 0.25
          },

        // SECONDARY COLOR FOR CLICKED SPACE
        spaceClickSecondaryColor: {
            color: [255, 255, 193, 0.5],
            outline: [255, 255, 21, 1]
        },


        // ROUTING INFO
        routingEnabled: true,

        routing: {
          filterFld: "FLOORKEY",
          taskUrl: 'https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_Network/NAServer',
          restrictions: {
              stairs: 'Prohibit: Elevators',
              elevator: 'Prohibit: Stairs'
          },

          // SYMBOLOGY
          // stairs route
          stairPathColor: [255,83,13],        //  [0,183,0],
          stairPathSize: 0.5,

          // elavator route
          elevatorPathColor: [0,0,255],
          elevatorPathSize: 0.5,

          // start/stop symbols
          startSymbol : {
              symbol: "\ue613",
              color: "#7A003C",
              font: {
                      size: 25,
                      family: "CalciteWebCoreIcons"
                    }
          },

          endSymbol : {
              symbol: "\ue61d",
              color: "#7A003C",
              font: {
                      size: 25,
                      family: "CalciteWebCoreIcons"
                    }
          },

          // vertical offset to place marker above route
          symbol_zOffset: 1,

          // offset fot the rendered route
          path_xOffset: 0,
          path_yOffset: 0,
          path_zOffset: 0

        },

        // ZOOM-IN LEVEL FOR SEARCH
        viewZoom: 22,
        viewTilt: 35,

        // space/room rendering info from feature layers - first renderer specified here is the default renderer for search and routing
        // fieldname is required - rendering field in Spaces layer may be different from the url rendering field
        // slide name : [url, fieldname]
        spaceRenderersForWebSlide: {
            'Interior': ['https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/6',"UNIT_ID"],
            'Vacancy': ['https://arcindpocappwv1.ci.raleigh.nc.us/arcgis/rest/services/Raleigh_Water_Indoors_GISTST_FS/FeatureServer/6',"UNIT_ID"]
        }

    };
});
