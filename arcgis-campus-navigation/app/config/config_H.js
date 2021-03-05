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
        portalUrl: '//www.arcgis.com',

        //WEB SCENE ID
        webSceneId:  "dbc64411502b4152bfa8cc3c73d920f1",

        // PROXY
        // proxyUrlPrefix: "",
        // proxyUrl: "",


        //NAME FOR INTERIOR SPACES/ROOMS(TO IDENTIFY SPACES LAYER IN A GROUP LAYER)
        spaceLayerStringIdentifier: "Interior Spaces",

        //FLOORPICKER
        floorPickerInfo: {
            1 :  {  buttonLabel: "1", value: "1"},
            2 :  {  buttonLabel: "2", value: "2"}
        },

        //HERE, LAYER NAME IS THE NAME OF LAYER AS SEEN IN TOC OF SCENE VIEWER
        floorsLayers: {
          "all": [
                { layerName: "Floorplan Walls", floorNumberFld: "FLOOR", floorIDFld: "FLOORKEY"},
                { layerName: "Floorplan Doors", floorNumberFld: "FLOOR", floorIDFld: "FLOORKEY"},
                { layerName: "Interior Spaces", floorNumberFld: "FLOOR", floorIDFld: "FLOORKEY"}
              ]
        },

        // FIELD SPECIFYING FLOOR NUMBER
        floorField: "FLOOR",

        // DEFAULT PLACEHOLDER FOR SEARCH WIDGET
        allSearchPlaceholder: "Find people or places",

        //SEARCH INFO
        searchInfo: {
            1 :  {
                    name: "Rooms",
                    dropdownSearch: {
                        placeholder: "Search for rooms",
                        queryUrl: "https://services2.arcgis.com/z2tnIkrLQ2BRzr6P/arcgis/rest/services/BuildingInteriorSpacePt_BldgH/FeatureServer/0",
                        queryFields: ["LONGNAME"],
                        suggestionTemplate: "{LONGNAME} ({SPACETYPE})"
                    },
                    outFields:["OBJECTID", "LONGNAME", "SHORTNAME", "FLOOR", "SPACEID", "BUILDING", "SPACETYPE", "FLOORKEY" ],

                    // associated info (Instead of Related Tables)
                    associatedInfo: {
                      //url: "http://services2.arcgis.com/z2tnIkrLQ2BRzr6P/ArcGIS/rest/services/EmployeeInfoPt_2017F/FeatureServer/0",
                      url: "https://services2.arcgis.com/z2tnIkrLQ2BRzr6P/ArcGIS/rest/services/PeoplePoints_BldgH/FeatureServer/0",
                      outFields:["KNOWNAS", "EMAIL", "EXTENSION"],
                      queryField: "LONGNAME",      // for this layer query
                      queryFieldType: "TEXT" ,    //or number
                      matchingQueryField: "LONGNAME",    // for the dropdownSearch layer
                    },

                    // INFO DISPLAYED IN SIDE PANEL
                    displayInfo: {
                        SPACETYPE: {class:"sp-info__subtitle", prefix:"", suffix:"" },
                        LONGNAME: {class:"sp-info__office" },
                        KNOWNAS: {class: "sp-info__name"},
                        EMAIL: {class:"sp-info__email" },
                        EXTENSION: {class:"sp-info__desc", prefix:"ext. ", suffix:"" }
                    },

                    // TEXT TO IDENTIFY CORRESPONDING SCENE LAYERS
                    correspondingSceneLyrName: "Interior Spaces",

                    // SYMBOLOGY FOR SELECTED SPACE/ROOM
                    selectionRendering: {
                        // this field is used to get label info
                        rendererField: "LONGNAME",

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
                    name: "People",
                    dropdownSearch: {
                        placeholder: "Search for people",
                        //queryUrl: "http://services2.arcgis.com/z2tnIkrLQ2BRzr6P/ArcGIS/rest/services/EmployeeInfoPt_2017F/FeatureServer/0",
                        queryUrl: "https://services2.arcgis.com/z2tnIkrLQ2BRzr6P/ArcGIS/rest/services/PeoplePoints_BldgH/FeatureServer/0",
                        queryFields: ["LONGNAME", "KNOWNAS"],
                        suggestionTemplate: "{KNOWNAS} ({LONGNAME})"
                    },
                    outFields:["OBJECTID", "LOCATION", "LONGNAME", "BUILDING", "KNOWNAS", "EMAIL", "EXTENSION" ],

                    // associated info (Instead of Related Tables)
                    associatedInfo: {
                      url: "https://services2.arcgis.com/z2tnIkrLQ2BRzr6P/arcgis/rest/services/BuildingInteriorSpacePt_BldgH/FeatureServer/0",
                      outFields:["SPACEID", "LONGNAME", "SHORTNAME", "FLOOR", "SPACETYPE", "FLOORKEY"],
                      queryField: "LONGNAME",      // for this layer
                      queryFieldType: "TEXT" ,    //or number
                      matchingQueryField: "LONGNAME",    // for the dropdownSearch layer
                    },

                    // INFO DISPLAYED IN SIDE PANEL
                    displayInfo: {
                        SPACETYPE: {class:"sp-info__subtitle", prefix:"", suffix:"" },
                        LONGNAME: {class:"sp-info__office" },
                        KNOWNAS: {class: "sp-info__name"},
                        EMAIL: {class:"sp-info__email" },
                        EXTENSION: {class:"sp-info__desc", prefix:"ext. ", suffix:"" }
                    },

                    // TEXT TO IDENTIFY CORRESPONDING SCENE LAYERS
                    correspondingSceneLyrName: "Interior Spaces",

                    // SYMBOLOGY FOR SELECTED SPACE/ROOM
                    selectionRendering: {
                        // this field is used to get label info
                        rendererField: "LONGNAME",

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
          taskUrl: 'http://3dcampus.arcgis.com/arcgis/rest/services/Routing/CampusNetwork_BldgH/NAServer/Route',
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
          path_zOffset: 1

        },

        // ZOOM-IN LEVEL FOR SEARCH
        viewZoom: 22,
        viewTilt: 35,

        // space/room rendering info from feature layers - first renderer specified here is the default renderer for search and routing
        // fieldname is required - rendering field in Spaces layer may be different from the url rendering field
        // slide name : [url, fieldname]
        spaceRenderersForWebSlide: {
            'Slide 2': ['https://services2.arcgis.com/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Building_Interior_Spaces_UseColor/FeatureServer/0',"SPACEID"]
        }

    };
});
