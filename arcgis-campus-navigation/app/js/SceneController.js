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
define([
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/symbols/PolygonSymbol3D",
    'esri/symbols/FillSymbol3DLayer',
    "esri/symbols/ExtrudeSymbol3DLayer",
    'esri/renderers/UniqueValueRenderer',
    "esri/geometry/Polygon",
    "esri/geometry/Point",
    "esri/geometry/Extent",

    "esri/PopupTemplate",
    "esri/symbols/PictureMarkerSymbol",
    "esri/geometry/support/webMercatorUtils",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "esri/geometry/geometryEngineAsync",
    "esri/core/watchUtils",
    "esri/request",

    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/topic",
    "dojo/promise/all"

    ],
    function(
        Graphic, GraphicsLayer, PolygonSymbol3D, FillSymbol3DLayer, ExtrudeSymbol3DLayer, UniqueValueRenderer, Polygon, Point, Extent,
        PopupTemplate, PictureMarkerSymbol,
        webMercatorUtils, QueryTask, Query, geometryEngineAsync, watchUtils, esriRequest,
        declare, lang, topic, all
        ) {

        "use strict";

        return declare([], {

            constructor: function(options) {
                this.config = options.config;
                this.sceneView = options.view;
                this.map = this.sceneView.map;

                this.containerDiv = options.containerDiv;
                this.appUtils = options.appUtils;

                this.spaceLayerViewsInfo = {};
                this.spaceLayerPromises = [];

                this.rendererPerWebSlide = {};
                this.renderingInfoPromises = [];

                this.nonFloorLayerViewsInfo = [];
                this.nonFloorLayerPromises = [];

                this.layersPerWebSlide = {};

                this.currentSlide = null;

                this.spaceMarkersGphLyr = new GraphicsLayer({id: 'spaceMarkers',
                    //this billboards the icons
                    elevationInfo: {
                        //setting the mode to “on-the-ground” drapes the icons
                        mode: "relative-to-ground",
                        offset: 1
                    }

                });
                this.map.add(this.spaceMarkersGphLyr);

                this.spacePolyGphLyr = new GraphicsLayer(
                  {id: 'spacePoly'
                });
                this.map.add(this.spacePolyGphLyr);

                this.graphicLayersView = {};

                this.roomSelectionSymbol = null;
                this.roomSelectionLabel = null;

                this.sceneViewLyrsInfo = {};
                this.sceneLyrsNameId = {};
                this.searchSourcesNames = {};
                this.featLyrRelatedShape = {};

                this.renderingLayers = [];

                this.floorsLayers = [];
                this.searchSceneLyrInfo = {};

                this.highlights = [];
                this.routeHighlights = [];

                this.renderIdsInfoPromises = [];

            },

            initView: function () {

                // set first slide as default
                this.currentSlide = this.map.presentation.slides.getItemAt(0);

                this._getSearchSceneLayerInfo();
                this._getLayerInfo();
                this._getAllRenderingInfo();
                this._sceneViewClickHandler();

                this.sceneView.highlightOptions = this.config.defaultHighlight;
            },

            _getLayerInfo: function() {
              var self = this;
              var flrNamesArr = Object.keys(this.config.floorsLayers);

              var allLayersAndSublayers = this.map.layers.flatten(function(item){
                return item.layers || item.sublayers;
              });


              // if (lyrInfo.title) {    // this is null for graphics layer
              // }

              // work for 'all floors in single layer' and 'layer per floor' scenarios??
              for (var i = 0; i < flrNamesArr.length; i++) {
                let flrName = flrNamesArr[i];
                let layersPerFloor = this.config.floorsLayers[flrName];

                for (var j = 0; j < layersPerFloor.length; j++)  {
                  let lyrInfo = {};

                  let floorIDFld = layersPerFloor[j].floorIDFld;
                  let lyrName = layersPerFloor[j].layerName;

                  var flrLayer = allLayersAndSublayers.find(function(findLyr){
                    if (lyrName.toLowerCase() === findLyr.title.toLowerCase())
                      return findLyr;
                  });

                  if (flrLayer) {
                    // for rendering and highlight
                    if (lyrName.toLowerCase().indexOf(this.config.spaceLayerStringIdentifier.toLowerCase()) > -1) {
                      this.renderingLayers.push(flrLayer);
                      this._handleSpaceLayerViewPromises(lyrName, flrLayer);
                    }

                    //for filtering def qry
                    lyrInfo["flrLyr"] = flrLayer;
                    lyrInfo["floorIDFld"] = floorIDFld;
                    this.floorsLayers.push(lyrInfo);
                  }
                }
              }

              all(self.spaceLayerPromises).then(function(resultsArr) {
                    resultsArr.forEach(function(result) {
                        //spaces layername and layerView
                        self.spaceLayerViewsInfo[result[0]] = result[1];
                    });
                  }, function(err) {
                    console.log(err);
                });

              this.sceneView.whenLayerView(this.spaceMarkersGphLyr)
                        .then(function(lv) {
                            self.graphicLayersView[self.spaceMarkersGphLyr.id] = lv;
                        } , function(error) {
                            console.log("error " + error);
                        }
                );

                this.sceneView.whenLayerView(this.spacePolyGphLyr)
                  .then(function(lv) {
                      self.graphicLayersView[self.spacePolyGphLyr.id] = lv;
                  } , function(error) {
                      console.log("error " + error);
                  }
                );
            },

            _handleSpaceLayerViewPromises: function(flrName, spaceLayer) {
                //layerView may not be initialized - also add to 'promises' array to get consolidated results
                this.spaceLayerPromises.push(
                    this.sceneView.whenLayerView(spaceLayer)
                        .then(function(layerView) {
                            return [flrName, layerView];
                        } , function(error) {
                            console.log("error " + error);
                        })
                );

            },


            _getSearchSceneLayerInfo: function() {
                // store layer and its search source
                var searchConfig = this.config.searchInfo;
                for (var searchOrder in searchConfig) {
                    if (searchConfig.hasOwnProperty(searchOrder)) {
                      var searchObj = searchConfig[searchOrder];
                      let info = {'selectionRendering': searchObj['selectionRendering'] };

                      // scene layer name is NOT same as feature layer
                      // store the layer nameID and search order for later reference
                      if ((searchObj.hasOwnProperty('correspondingSceneLyrName')) && (searchObj['correspondingSceneLyrName'].length > 0)) {
                          info['correspondingSceneLyrName'] = searchObj['correspondingSceneLyrName'];

                      } else {
                          // scenelayer name is same as featurelayer name
                          // store source name and scene layer name
                          var lyrUrl = searchObj.dropdownSearch.queryUrl;
                          var lyrName = this.appUtils.layerNameFromUrl(lyrUrl, '/FeatureServer');
                          info['correspondingSceneLyrName'] = lyrName;
                      }

                      if (searchObj.hasOwnProperty('associatedInfo') && searchObj['associatedInfo']['url'].toString().length > 0) {
                        info['associatedInfo'] = searchObj['associatedInfo'];
                      }

                      // main query field for corresponding feat layer
                      info['queryField'] = searchObj['dropdownSearch']['queryFields'][0];
                      info['outFields'] = searchObj['outFields'];


                      this.searchSceneLyrInfo[searchObj.name] = info;
                    }
                }
            },

            _getAllRenderingInfo: function() {
                var self = this;
                var allRenderers = this.config.spaceRenderersForWebSlide;

                for (var slideName in allRenderers){
                    if (allRenderers.hasOwnProperty(slideName)) {
                        this._handleRenderingInfoPromises(slideName);
                    }
                }

                all(self.renderingInfoPromises).then(function(resultsArr) {
                    resultsArr.forEach(function(result) {
                        // slide name and colors
                        self.rendererPerWebSlide[result[0]] = result[1];
                    });
                    // initial rendering after promises are returned
                    self.defaultRendering(self.currentSlide.title.text);
                  }, function(err) {
                    console.log(err);
                  });
            },

            _handleRenderingInfoPromises: function(slideName){
                this.renderingInfoPromises.push(
                    this.appUtils.retrieveFeatureLayerColors(this.config.spaceRenderersForWebSlide[slideName][0])
                        .then(function(featLyrColsInfo) {
                            return [slideName, featLyrColsInfo];
                        } , function(error) {
                            console.log("error " + error);
                        })
                );
            },


            _sceneViewClickHandler: function() {
                this.sceneView.on("click", lang.hitch(this, function(evt) {
                     //get screen point and use it in hitTest to get graphic
                    this.sceneView.hitTest(evt.screenPoint).then(lang.hitch(this, function(response) {
                        var result = response.results[0];
                        // multipatch features should return a graphic (handling space click for now)
                        if ((result.graphic) && (result.graphic.layer.title) && (result.graphic.layer.title.toLowerCase() === this.config.spaceLayerStringIdentifier.toLowerCase())) {
                            this._clickFeature(result);
                        } else {
                            // no graphic - 2D poly feature ?

                        }
                    }));
                }));
            },

            _clickFeature: function(clickResult) {

              var lyrName = clickResult.graphic.layer.title;
              var lyrVw = this.spaceLayerViewsInfo[lyrName];

              if (this.routeHighlights.length > 0) {
                // in routing mode with route displayed
                // any clicked space in this case is displayed with diff color to differentiate from routed spaces
                this.renderClickedSpaceTemporary(lyrVw, clickResult );

              } else {
                this.clearHighlights();
                this.highlights.push(lyrVw.highlight(clickResult.graphic));
              }

              // clicked room/space feature's geom is null (clickResult.graphic.geometry)
              // however the clicked point geom is available (clickResult.mapPoint)
              // as routing needs point geom, and also need the room/space attr,
              // temp workaround is to have a new object with clicked mapPoint geom and the corresponding graphic's attr
              let newObj = {
                attributes: clickResult.graphic.attributes,
                geometry: clickResult.mapPoint
                };

              // use 'objectid' from clicked graphic to query other 'space' attr
              // then get associated info

              // temp workaround - get associated info from config for this layer
              for (let prop in this.searchSceneLyrInfo) {
                if (this.searchSceneLyrInfo.hasOwnProperty(prop)) {
                  if (this.searchSceneLyrInfo[prop]['correspondingSceneLyrName'].toLowerCase() === lyrName.toLowerCase()) {

                    let oid = newObj.attributes[lyrVw.layer.objectIdField];
                    var params = new Query({
                      returnGeometry: false,
                      outFields: this.searchSceneLyrInfo[prop]['outFields'],
                      where: lyrVw.layer.objectIdField + " = " + oid
                    });

                    lyrVw.layer.queryFeatures(params)
                      .then(this.appUtils.getConsolidatedAttrs.bind(this.appUtils, newObj))
                      .then (function (consolData) {

                        consolData.attributes['srcName'] = prop;

                        // store the multipatch feature's OID and marker info for route highlighting later
                        consolData.attributes['sceneFeatureOID'] = oid;
                        consolData.attributes['markerRenderInfo'] = this.searchSceneLyrInfo[prop]['selectionRendering'];

                        if (this.searchSceneLyrInfo[prop]['associatedInfo']) {
                          // get the config info as array
                          var associatedInfo = this.appUtils.getAssociatedInfo(this.searchSceneLyrInfo[prop]['associatedInfo'], newObj);

                          this.appUtils.getAssociatedResults(associatedInfo)
                            .then(this.appUtils.consolidateInfo.bind(this, consolData))
                            .then(function(updtData) {

                              // if multiple results 1:many , return geometry and attrs of multiple results
                              if (updtData[0]) {  // value of multipleFlg
                                this.setClickedFeatureSymbology(newObj, this.searchSceneLyrInfo[prop]['selectionRendering']);
                                topic.publish("room-click-multipleResults", newObj, updtData[1]);
                              } else {

                                var lbls1 = this.setClickedFeatureSymbology(updtData[1], this.searchSceneLyrInfo[prop]['selectionRendering']);
                                //this.clickHighlight.push([highlt, lbls1]);
                                // if 1:1 results , result attr are consolidated with geometry
                                topic.publish("room-click", updtData[1]);
                              }
                            }.bind(this));
                        } else {
                          var lbls2 = this.setClickedFeatureSymbology(consolData, this.searchSceneLyrInfo[prop]['selectionRendering']);
                          //this.clickHighlight.push([highlt, lbls2]);
                          topic.publish("room-click", consolData);
                        }

                      }.bind(this));
                      break;
                  }
                }
              }
            },

            renderClickedSpaceTemporary:function(lyrVw, clickResult ) {

              this.spacePolyGphLyr.removeAll();

              var sym = new PolygonSymbol3D({
                symbolLayers: [new FillSymbol3DLayer({
                  material: { color: this.config.spaceClickSecondaryColor.color },
                  outline: { color: this.config.spaceClickSecondaryColor.outline,
                            size: 3 }
                })]
              });

              var query = new Query();
              query.objectIds = [clickResult.graphic.attributes[lyrVw.layer.objectIdField]];

              // get polygon extent
              lyrVw.queryExtent(query).then(function(result) {
                if (!result.extent.spatialReference.isWebMercator) {
                  //project
                  if (webMercatorUtils.canProject(result.extent.spatialReference, this.sceneView.spatialReference)) {
                      result.extent = webMercatorUtils.project(result.extent , this.sceneView.spatialReference);
                  }
                }

                var polygon = Polygon.fromExtent(result.extent);
                // update the Z value
                let polyRings = polygon.rings[0];
                for (var i=0; i < polyRings.length ; i++) {
                  polyRings[i][2] = result.extent.zmax + 0.1;
                }

                var newPoly = new Polygon({
                  hasZ: true,
                  spatialReference: this.sceneView.spatialReference,
                  rings: polyRings
                });

                var spaceGph = new Graphic({
                  geometry: newPoly,
                  symbol: sym
                });
                this.spacePolyGphLyr.add(spaceGph);

                this.graphicLayersView[this.spacePolyGphLyr.id].visible = true;

              }.bind(this));
            },

            setClickedFeatureSymbology: function(feat, renderInfo) {
              // ADD MARKER AND LABEL
              var val = feat.attributes[renderInfo.rendererField];
              if (val == null) {
                val = "";
              }
              return this.addLocationMarkerLabels(feat.geometry, val, renderInfo);

            },

            setSelectedFeatureSymbology: function (evt) {

              // this is the feat returned from search widget
              var feat = evt.results[0].results[0].feature;
              var targetGeom = feat.geometry;

              var resultSrcName = evt.results[0].source.name;
              var lyrName = this.searchSceneLyrInfo[resultSrcName]['correspondingSceneLyrName'];
              var lyrVw = this.spaceLayerViewsInfo[lyrName];

              if (!targetGeom.spatialReference.isWebMercator) {
                //project
                if (webMercatorUtils.canProject(targetGeom.spatialReference, this.sceneView.spatialReference)) {
                    targetGeom = webMercatorUtils.project(targetGeom , this.sceneView.spatialReference);
                }
              }

              // clear prev highlights
              this.clearHighlights();

              this.sceneView.goTo({
                target: targetGeom,   //result.features,
                tilt: this.config.viewTilt,
                zoom: this.config.viewZoom
              }).then( function() {

                // ADD MARKER AND LABEL
                targetGeom.z = targetGeom.z + 0.2; // slight offset to display above space
                var renderInfo = this.searchSceneLyrInfo[resultSrcName]['selectionRendering'];
                this.addLocationMarkerLabels(targetGeom, feat.attributes[renderInfo.rendererField], renderInfo);

                // queryExtent currently only handles objectid
                // and point feat objectid may not be same as multipatch objectid

                // first get point's location attr , and then get OID from scene's companion layer
                // and then get multipatch from scene
                var fld = this.searchSceneLyrInfo[resultSrcName]['queryField'];

                var oIDQuery = new Query({
                  where: fld + " = '" + feat.attributes[fld] + "'" ,
                  outFields: [lyrVw.layer.objectIdField]
                });

                lyrVw.layer.companionFeatureLayer.queryFeatures(oIDQuery)
                  .then(lang.hitch(this, function(oidResult) {

                    watchUtils.whenFalse(lyrVw, "updating", function() {
                      // to prevent 'updating' multiple times when screen changes
                      if (oidResult) {
                        var oid = oidResult.features["0"].attributes[lyrVw.layer.objectIdField];
                        var query = new Query({
                        objectIds: [oid]
                        });

                        lyrVw.queryFeatures(query).then(function(sceneResult) {
                          this.highlights.push(lyrVw.highlight(sceneResult.features));
                          // store the multipatch feature's OID and marker info for route highlighting later
                          evt.results[0].results[0].feature.attributes['sceneFeatureOID'] = oid;
                          evt.results[0].results[0].feature.attributes['markerRenderInfo'] = renderInfo;
                          topic.publish("sidePanel/SearchInfo", evt);
                        }.bind(this));

                        // to prevent 'updating' multiple times when screen changes
                        oidResult = null;
                      }

                    }.bind(this));
                }));

              }.bind(this));

              var flr = null;
              if (feat.attributes.hasOwnProperty(this.config.floorField)) {
                  flr = feat.attributes[this.config.floorField];
              } else {
                  flr = "1";    //default value - currently to handle 2D POI features
              }

              topic.publish("floorPicker/switchFloors", flr, false);

            },

            zoomToFeature: function(evt) {

              // get current slide floor rendering info
              var rendererWebSlide = this.config.spaceRenderersForWebSlide[this.currentSlide.title.text];

              if (!rendererWebSlide) {
                  // current slide has no interior floors - hence no default rendering info for floors
                  // so default to first rendering info for display of all spaces
                  var slideName = Object.keys(this.config.spaceRenderersForWebSlide)[0];
                  topic.publish("changeSlide-zoom", slideName, evt);

              } else {
                  this.setSelectedFeatureSymbology(evt);
              }
            },

            addLocationMarkerLabels: function(pt, labelTxt, renderInfo) {

                // remove old markers
                this.spaceMarkersGphLyr.removeAll();

                if (!this.roomSelectionSymbol) {
                    this.roomSelectionSymbol = this.appUtils.getTextSymbol(renderInfo.symbol, renderInfo.symbolColor, renderInfo.symbolFont);
                }

                // since text not gettign updated , create label everytime
                //if  (!this.roomSelectionLabel) {
                     //this.roomSelectionLabel = this.appUtils.getTextLabel(this.config);
                //}
                //this.roomSelectionLabel.text = labelTxt + this.config.roomSelectionLabelSymbolSpacing;

                this.roomSelectionLabel = this.appUtils.getTextSymbol(labelTxt + renderInfo.labelSymbolSpacing, renderInfo.labelColor, renderInfo.labelFont );

                var txtGraphic = new Graphic({
                  geometry: pt,
                  symbol: this.roomSelectionSymbol
                });

                var txtGraphic2 = new Graphic({
                  geometry: pt,
                  symbol: this.roomSelectionLabel   //symbol3
                });

                this.spaceMarkersGphLyr.add(txtGraphic);
                this.spaceMarkersGphLyr.add(txtGraphic2);

                this.graphicLayersView[this.spaceMarkersGphLyr.id].visible = true;
                return [txtGraphic, txtGraphic2 ];

            },

            defaultRendering: function(slideName) {

              this.renderIdsInfoPromises = [];

              // clear get layer info
              for (var cnt = 0; cnt < this.renderingLayers.length; cnt++) {
                var lyr = this.renderingLayers[cnt];
                lyr.renderer = null;
              }

              var rendererWebSlide = this.config.spaceRenderersForWebSlide[slideName];
              if (!rendererWebSlide) { return; }
              let sceneLyrRenderingField = rendererWebSlide[1];


              // rendererInfo = [rendererFld, {val:color,val:color..}]
              var rendererInfo = this.rendererPerWebSlide[slideName];
              var featLyrCols = rendererInfo[1];
              var renderFld = rendererInfo[0];

              let valSymbols = {};

              for (var val in featLyrCols){
                if (featLyrCols.hasOwnProperty(val)) {
                  var lyrFill = new FillSymbol3DLayer({
                      material: { color: featLyrCols[val] }
                  });
                  var pSymbolLayers = [lyrFill];

                  var polySymbol = new PolygonSymbol3D();
                  polySymbol.symbolLayers = pSymbolLayers;

                  //bug? why need to reset this?
                  polySymbol.color = polySymbol.symbolLayers.items["0"].material.color;
                  valSymbols[val] = polySymbol;
                }
              }

              // default symbol - need to handle any 'other values', not just defaultLabel value
              var defaultFill = new FillSymbol3DLayer({
                  material: { color: rendererInfo[4].color }
              });
              var pDefaultSymbolLayers = [defaultFill];

              var pDefaultSymbol = new PolygonSymbol3D();
              pDefaultSymbol.symbolLayers = pDefaultSymbolLayers;
              //bug? why need to reset this?
              pDefaultSymbol.color = pDefaultSymbol.symbolLayers.items["0"].material.color;


              let valKeys = Object.keys(valSymbols);

              var uniqRenderer = new UniqueValueRenderer({
                         field: sceneLyrRenderingField   // CASE-SENSITIVE
              });
              uniqRenderer.defaultLabel = rendererInfo[3];
              uniqRenderer.defaultSymbol = pDefaultSymbol;


              // read poly FL to get render info
              // read point FL for fld (VACANT etc) value (updated regularly) and get SPACEID
              // use SPACEID to then render scene layer

              //temp workaround - get first point feat layer from config
              var qryUrl = this.config.searchInfo[1].dropdownSearch.queryUrl;
              let qryWhere = " 1 = 1 ";
              var outFlds = [sceneLyrRenderingField, renderFld] ;

              // workaround to max record limit - objectids returns > 2000 records
              this.appUtils.getQueryIds(qryUrl, qryWhere)
                .then(lang.hitch( this, function(idResults) {

                var idsCount = idResults.objectIds.length;
                var loopCnt = 1; //set to 1 to handle less than 2000 count
                if (idsCount > 2000) {
                  loopCnt = Math.ceil(idsCount/2000);
                }

                // run query for blocks of 2000
                for (var lpCnt = 0; lpCnt < loopCnt; lpCnt++) {
                  let newArr = idResults.objectIds.splice(0,2000);
                  qryWhere = idResults.objectIdFieldName + " IN (" + newArr.toString() + ")";

                  this.renderIdsInfoPromises.push(
                    this.appUtils.getQueryResults(qryUrl, qryWhere, outFlds)
                    .then(lang.hitch( this, function(results) {

                      for (var i = 0 ; i < results.length; i++) {
                        let rendererVal = results[i].attributes[renderFld];
                        let keyVal = results[i].attributes[sceneLyrRenderingField];

                        // in some cases rendererVal 'type' is 'number' and 0 returned as false - so check for null
                        //if (rendererVal && rendererVal.toString().length > 0) { // will skip if value was 0
                        if (rendererVal != null) {
                          if ((valKeys.indexOf(rendererVal.toString()) > -1) ){
                            uniqRenderer.addUniqueValueInfo(keyVal, valSymbols[rendererVal]);
                          } else {
                            uniqRenderer.addUniqueValueInfo(keyVal, pDefaultSymbol);
                          }
                        } else {
                          uniqRenderer.addUniqueValueInfo(keyVal, pDefaultSymbol);
                        }

                      }
                    }))
                  );
                }

                all(this.renderIdsInfoPromises).then(lang.hitch(this, function() {
                  for (var j = 0; j < this.renderingLayers.length; j++) {
                    var rendLyr = this.renderingLayers[j];
                    rendLyr.renderer = uniqRenderer;
                  }

                  }, function(err) {
                    console.log(err);
                }));
              }));
            },

            updateCurrentSlide: function(slideName) {
                // also clear any old graphics used in previous slide
                this.spaceMarkersGphLyr.removeAll();
                this.clearHighlights();
                this.clearRouteSpaceHighlights();

                var slide = this.sceneView.map.presentation.slides.find(function(item){
                    if(item.title.text.toLowerCase().indexOf(slideName.toLowerCase()) > -1) {
                        return item;
                    }
                });

                this.currentSlide = slide;
            },

            supportsSessionStorage: function() {
                if (typeof(window.sessionStorage) !== undefined ) {
                    return true;
                }
                else {
                    return false;
                }
            },

            appyDefExp: function(bldgFlrs) {
                this._refreshDefQry(bldgFlrs);

            },

            _refreshDefQry: function(defQry) {
              for (var i=0; i < this.floorsLayers.length; i++) {
                  var item = this.floorsLayers[i];
                  var lyr = item["flrLyr"];
                  if (defQry) {
                    lyr.definitionExpression = item["floorIDFld"] + " IN (" + defQry + ")";
                  } else {
                    lyr.definitionExpression = "";
                  }

              }
            },

            clearHighlights: function() {
              if (this.highlights.length > 0) {
                this.highlights.forEach(function(highlight) {
                  highlight.remove();
                });
                this.highlights = [];
              }
            },

            addRouteSpaceHighlights: function(arrGphs) {
              var lyrVw = this.spaceLayerViewsInfo[this.config.spaceLayerStringIdentifier];
              this.routeHighlights.push(lyrVw.highlight(arrGphs));
            },

            clearRouteSpaceHighlights: function() {
              this.routeHighlights.forEach(function(highlight) {
                  highlight.remove();
                });
              this.routeHighlights = [];
            },

            clearAllGraphics: function() {
                this.spaceMarkersGphLyr.removeAll();
                this.spacePolyGphLyr.removeAll();
            },

            floorLayersAvailable: function() {

               // get current slide floor rendering info
              var rendererWebSlide = this.config.spaceRenderersForWebSlide[this.currentSlide.title.text];

              if (!rendererWebSlide) {
                // current slide has no interior floors as per rendering config info
                return false;
              } else {
                return true;
              }
            }

        });

    });

