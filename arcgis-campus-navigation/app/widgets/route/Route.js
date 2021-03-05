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
      "dojo/_base/declare",
      "dojo/topic",
      "dojo/_base/lang",

      "esri/Graphic",
      "esri/layers/GraphicsLayer",
      "esri/geometry/SpatialReference",
      "esri/tasks/support/FeatureSet",
      "esri/core/urlUtils",
      "esri/symbols/LineSymbol3D",
      "esri/symbols/PathSymbol3DLayer",
      "esri/geometry/Point",
      "esri/geometry/support/webMercatorUtils",
      "esri/geometry/Polyline",
      "esri/request"

    ], function(
      declare, topic, lang,
      Graphic, GraphicsLayer, SpatialReference,
      FeatureSet, urlUtils,
      LineSymbol3D, PathSymbol3DLayer, Point, webMercatorUtils, Polyline, esriRequest
    ) {

        "use strict";

        return declare([], {

          constructor: function(options) {
            this.config = options.config;
            this.view = options.view;
            this.appUtils = options.appUtils;

            this.restrictionValue = "";
            this.routeUrl = this.config.routing.taskUrl + "/solve";
            this.opt = {};

            //The stops and route result will be stored in this layer
            this.gphLyr = new GraphicsLayer({id: 'routeStopsLyr'});
            this.view.map.add(this.gphLyr);

            this.gphLyrView = null;

            this.view.whenLayerView(this.gphLyr)
                        .then(lang.hitch(this, function(layerView) {
                            this.gphLyrView = layerView;
                        }) , function(error) {
                            console.log("error " + error);
                        });

            this.bldgFlrs = [];
            this.highlightOIDs = [];
        },

          startup: function() {

            // IF USING PROXY
            // urlUtils.addProxyRule({
            //     urlPrefix: this.config.proxyUrlPrefix,
            //     proxyUrl: this.config.proxyUrl
            // });


            //NOT USING ROUTE TASK - Z BEING DROPPED. USING ESRIREQUEST INSTEAD
            this.opt = {
                useProxy: false,
                query: {
                    f: 'json',
                    returnDirections:false,
                    returnRoutes:true,
                    returnZ:true,
                    returnStops:false,
                    returnBarriers:false,
                    returnPolygonBarriers:false,
                    returnPolylineBarriers:false,
                    outSR:102100,
                    outputLines:'esriNAOutputLineTrueShape',
                    restrictionAttributeNames: this.config.routing.restrictions.stairs
                }
            };

            this.routeStartSymbol = this.appUtils.getTextSymbol(this.config.routing.startSymbol.symbol, this.config.routing.startSymbol.color, this.config.routing.startSymbol.font);
            this.routeEndSymbol = this.appUtils.getTextSymbol(this.config.routing.endSymbol.symbol, this.config.routing.endSymbol.color, this.config.routing.endSymbol.font);

            this.routeStairSymbol = new LineSymbol3D(
              new PathSymbol3DLayer({
                size: this.config.routing.stairPathSize,
                material: { color: this.config.routing.stairPathColor }
              })
            );

            this.routeElevatorSymbol = new LineSymbol3D(
              new PathSymbol3DLayer({
                size: this.config.routing.elevatorPathSize,
                material: { color: this.config.routing.elevatorPathColor }
              })
            );

            this.routingFilterFld = this.config.routing.filterFld;

          },

        startRouting: function(startInfo, destinationInfo, elevator) {

          this.bldgFlrs = [];
          this.bldgFlrs.push("'" + startInfo.attributes[this.routingFilterFld] + "'");
          this.bldgFlrs.push("'" + destinationInfo.attributes[this.routingFilterFld] + "'");

          this.highlightOIDs = [];
          this.highlightOIDs.push(startInfo.attributes['sceneFeatureOID']);
          this.highlightOIDs.push(destinationInfo.attributes['sceneFeatureOID']);

          this.markerRenderInfo = {};
          var renderInfo =  startInfo.attributes['markerRenderInfo'];
          this.markerRenderInfo[1] = {
            labelTxt: startInfo.attributes[renderInfo.rendererField],
            renderInfo: renderInfo
          };

          renderInfo =  destinationInfo.attributes['markerRenderInfo'];
          this.markerRenderInfo[2] = {
            labelTxt: destinationInfo.attributes[renderInfo.rendererField],
            renderInfo: renderInfo
          };


          // clear old routing
          this.clearRouting();
          topic.publish("clear-nonRoute-graphics", this.gphLyr.id);

          if (this.gphLyrView.visible === false) {
              this.gphLyrView.visible = true;
          }

          this.routeStops = {};
          this.geometryProjectionsPromises = [];

          // can loop this later if more points are added
          // params is order #, point

          this.routeStops[1] = this._getProjectedGeom(startInfo.geometry);
          this.routeStops[2] = this._getProjectedGeom(destinationInfo.geometry);

          this._startRouting(elevator);

        },

        _startRouting: function(elevator) {

            var firstStop = new Graphic({
                geometry: this.routeStops[1]
              });

            var lastStop = new Graphic({
                geometry: this.routeStops[2]
              });

            var featSet = new FeatureSet({
                                geometryType:'point',
                                spatialReference: SpatialReference.WebMercator
                            });

            featSet.features.push(firstStop);
            featSet.features.push(lastStop);
            var stopsJson = featSet.toJSON();

            this.opt.query['stops'] = JSON.stringify(stopsJson);

            if (elevator) {
                this.restrictionValue = this.config.routing.restrictions.elevator;
            } else {
                this.restrictionValue = this.config.routing.restrictions.stairs;
            }
            this.opt.query['restrictionAttributeNames'] =  this.restrictionValue;
            esriRequest(this.routeUrl, this.opt).then(lang.hitch(this, this._showRoute), this.errRoute);

        },

        _displayRouteStops: function(firstStopCoords, lastStopCoords, spatRef) {

            var firstStop = new Point({
                            x: firstStopCoords[0],
                            y: firstStopCoords[1],
                            z: firstStopCoords[2],
                            spatialReference: spatRef
                          });

            var lastStop = new Point({
                            x: lastStopCoords[0],
                            y: lastStopCoords[1],
                            z: lastStopCoords[2],
                            spatialReference: spatRef
                          });

            // to move marker above the route line
            firstStop.z = firstStop.z + this.config.routing.symbol_zOffset ;
            lastStop.z = lastStop.z + this.config.routing.symbol_zOffset ;

            var gphFirstStop = new Graphic({
                geometry: firstStop,
                symbol: this.routeStartSymbol
              });
            this.gphLyr.graphics.add(gphFirstStop);

            var gphLastStop = new Graphic({
                geometry: lastStop,
                symbol: this.routeEndSymbol
              });
            this.gphLyr.graphics.add(gphLastStop);

            // to move labels above the route line and markers
            // firstStop.z = firstStop.z + this.config.routing.symbol_zOffset ;
            // lastStop.z = lastStop.z + this.config.routing.symbol_zOffset ;

            var firstLabel = this.appUtils.getTextSymbol(this.markerRenderInfo[1].labelTxt + this.markerRenderInfo[1].renderInfo.labelSymbolSpacing, this.markerRenderInfo[1].renderInfo.labelColor, this.markerRenderInfo[1].renderInfo.labelFont );
            var lastLabel = this.appUtils.getTextSymbol(this.markerRenderInfo[2].labelTxt + this.markerRenderInfo[2].renderInfo.labelSymbolSpacing, this.markerRenderInfo[2].renderInfo.labelColor, this.markerRenderInfo[2].renderInfo.labelFont );

            var gphFirstLabel = new Graphic({
              geometry: firstStop,
              symbol: firstLabel
            });
            this.gphLyr.graphics.add(gphFirstLabel);

            var gphLastLabel = new Graphic({
              geometry: lastStop,
              symbol: lastLabel
            });
            this.gphLyr.graphics.add(gphLastLabel);

        },


        //Adds the solved route to the map as a graphic
        _showRoute: function(response) {

            var feat = response.data.routes.features[0];
            var pathLength = feat.geometry.paths[0].length;

            for (var i = 0; i < pathLength; i++ ) {

                // offset route path if needed -  offset maybe negative values also
                var tmpX = feat.geometry.paths[0][i][0];    // will vary by floor
                feat.geometry.paths[0][i][0] = tmpX + ( this.config.routing.path_xOffset) ;

                var tmpY = feat.geometry.paths[0][i][1];    // will vary by floor
                feat.geometry.paths[0][i][1] = tmpY + ( this.config.routing.path_yOffset) ;

                var tmpZ = feat.geometry.paths[0][i][2];    // will vary by floor
                feat.geometry.paths[0][i][2] = tmpZ + ( this.config.routing.path_zOffset) ;
            }

            this._displayRouteStops(feat.geometry.paths[0][0], feat.geometry.paths[0][pathLength-1], SpatialReference.WebMercator );

            var polyLn = new Polyline({
                                        hasZ: true,
                                        paths: feat.geometry.paths,
                                        spatialReference: SpatialReference.WebMercator
                                    });

            var rte = new Graphic({
                geometry: polyLn
              });

            if (this.restrictionValue === this.config.routing.restrictions.stairs) {
                rte.symbol = this.routeStairSymbol;
            } else {
                rte.symbol = this.routeElevatorSymbol;
            }
            this.gphLyr.graphics.add(rte);

            var walkTm = feat.attributes.Total_WalkTime.toFixed(2);
            var decSec = walkTm.substring(walkTm.indexOf(".")); //include decimal
            var sec = Math.round(Number(decSec) * 60);

            sec = sec < 10? '0' + sec : sec; //add leading zero

            var min = walkTm.substring(0, walkTm.indexOf("."));

            var attr = { "WalkTime":  min + ":" + sec,
                         "RouteLength" : feat.attributes.Total_Length.toFixed(2)
                        };

            //zoom to route extent
            var ext = polyLn.extent.expand(1.25);
            this.view.goTo({
                  target: ext,
                  tilt : 35
                });

            topic.publish("route/complete", attr, this.bldgFlrs, this.highlightOIDs);
        },

        _getProjectedGeom: function(geom) {
            var targetGeom = geom;
            if (!targetGeom.spatialReference.isWebMercator) {
                //project
                if (webMercatorUtils.canProject(targetGeom.spatialReference, this.view.spatialReference)) {
                    targetGeom = webMercatorUtils.project(targetGeom , this.view.spatialReference);
               }
            }

            // Proj from wgs84 to mercator causes z to be dropped
            // affects the POI and Evac - but z will be 0 for these.
            if (!targetGeom.hasZ) {
                // create new point with only needed properties
                var projPt = new Point({
                                    hasZ: true,
                                    x: targetGeom.x,
                                    y: targetGeom.y,
                                    z: 0,
                                    spatialReference: SpatialReference.WebMercator
                                });
                targetGeom = projPt;
            }

            return targetGeom;

        },

        clearRouting: function() {
            this.gphLyr.removeAll();

        },

        errRoute: function (err) {
            console.log(err);
            topic.publish("route/error", err);
        }
    });
});
