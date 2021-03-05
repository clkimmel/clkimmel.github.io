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
      "esri/views/SceneView",
      "esri/WebScene",
      "esri/config",
      "esri/widgets/Home",
      "esri/core/watchUtils",


      "floorpicker/FloorPickerView",
      "campussearch/CampusSearch",
      "info/InfoView",
      "route/Route",
      "sidepanel/SidePanelView",
      "navToggle/NavToggle",
      "./SceneController",
      "./appUtils",

      "dojo/_base/lang",
      "dojo/topic",
      "dojo/query"

    ], function(
      SceneView, WebScene, esriConfig, Home, watchUtils,
      FloorPickerView, CampusSearch, InfoBtn, Route, SidePanelView, NavToggle, SceneController, appUtils,
      lang, topic, dojoQuery
    ) {

        "use strict";

        return {

            startup: function(config) {
                this.config = config;
                this.routingMode = false;

                this.view = null;
                this.updateUIInfo();
                this.initView();

                this.routingEnabled = this.config.routingEnabled;

            },

            updateUIInfo: function() {
                var header = dojoQuery(".header__title")[0];
                header.innerHTML = this.config.app.headerTitle;

                var tab__title = dojoQuery(".tab__title")[0];
                tab__title.innerHTML = this.config.app.headerTitle;

                var logo = dojoQuery(".header__image")[0];
                logo.src = this.config.app.logoImage;

                var logoLink = dojoQuery(".header__link")[0];
                logoLink.href = this.config.app.headerLink;


            },

            initView: function() {

                esriConfig.portalUrl =  this.config.portalUrl;
                this.scene = new WebScene({
                    portalItem:       //new PortalItem( - autocasting
                    {
                      id: this.config.webSceneId
                    }
                });

                this.view = new SceneView({
                    map: this.scene,
                    container: "map",
                    popup:null      //no popups for any layer
                });

                this.view.then(lang.hitch(this, function() {
                    //All the resources in the SceneView and the map have loaded.
                    this.sceneController = new SceneController({
                                                  config:this.config,
                                                  view: this.view,
                                                  containerDiv: "map",
                                                  appUtils: appUtils
                                                  });
                    this.sceneController.initView();

                    this.initWidgets();
                    this.handleTopics();

                }), function (error) {
                console.log("The view's resources failed to load: ", error);
                });

                this.view.ui.remove("navigation-toggle");

            },

            initWidgets: function() {

                this.sidePanel = new SidePanelView({
                    view: this.view,
                    containerDiv: 'left-panel',
                    config: this.config,
                    appUtils: appUtils
                });
                this.sidePanel.startup();

                this.homeBtn = new Home({
                    view: this.view,
                    container: 'extent-home-container'
                });

                this.navToggle = new NavToggle({
                    view: this.view,
                    containerDiv: 'nav-toggle-container',
                });
                this.navToggle.startup();

                this.infoBtn = new InfoBtn({
                    view: this.view,
                    containerDiv: 'info-btn-tab',
                    config: this.config
                });
                this.infoBtn.startup();

                this.floorPicker = new FloorPickerView({
                    view: this.view,
                    containerDiv: 'floor-picker',
                    config: this.config
                });
                this.floorPicker.startup();

                this.campussearch = new CampusSearch({
                    view: this.view,
                    containerDiv: "search",
                    config:  this.config,
                    appUtils: appUtils
                    });
                this.campussearch.startup();

                if (this.routingEnabled) {
                  this.route = new Route({
                      view: this.view,
                      config: this.config,
                      appUtils: appUtils
                  });
                  this.route.startup();
                }

                this.sidePanel.open('info');
            },

            handleTopics: function() {

                topic.subscribe("sidePanel/open", lang.hitch(this, function(event) {
                    this.sidePanel.open(event.card);
                }));

                topic.subscribe("sidePanel/toggle", lang.hitch(this, function() {
                    this.sidePanel.toggle();
                }));

                topic.subscribe("sidePanel/close", lang.hitch(this, function(event) {
                    this.sceneController.clearHighlights();
                    this.sceneController.clearAllGraphics();
                }));

                topic.subscribe("infoBtn/reset", lang.hitch(this, function() {
                    this.infoBtn.reset();
                }));

                topic.subscribe("infoBtn/hide", lang.hitch(this, function() {
                    this.infoBtn.hide();
                }));

                topic.subscribe("infoBtn/routeInProgress", lang.hitch(this, function(event) {
                    this.infoBtn.routeInProgress(event.status);
                }));

                topic.subscribe("navToggle/routeInProgress", lang.hitch(this, function(event) {
                    this.navToggle.routeInProgress(event.status);
                }));

                topic.subscribe("floorPicker/switchFloors", lang.hitch(this, function(floor, multiSelect) {
                    this.floorPicker.floorButtonClick(floor, multiSelect);
                }));

                topic.subscribe("slide-floorLayersAvailable", lang.hitch(this, function() {
                    if (!this.sceneController.floorLayersAvailable()) {
                      // current slide has no interior floors - switch to default slide that has interior floors
                      var slideName = Object.keys(this.config.spaceRenderersForWebSlide)[0];
                      this.sidePanel.slideCard.resetSlideLayers(slideName).then(lang.hitch(this, function(flg) {
                        if (flg) {
                            topic.publish("slideCard/slideChanged", slideName);
                        }
                    }));
                    }
                }));

                topic.subscribe("search/complete", lang.hitch(this, function(evt) {
                    this.sceneController.zoomToFeature(evt);

                    //topic.publish("sidePanel/SearchInfo", evt);
                }));

                topic.subscribe("sidePanel/SearchInfo", lang.hitch(this, function(evt) {
                    this.sidePanel.handleSearchInfo(evt);
                }));

                topic.subscribe("search/multipleResults", lang.hitch(this, function(evt,multipleResults) {
                    this.sidePanel.handleSearchMultipleResults(evt, multipleResults);
                }));

                topic.subscribe("room-click", lang.hitch(this, function(feat) {
                    this.sidePanel.handleClickInfo(feat);
                }));

                topic.subscribe("room-click-multipleResults", lang.hitch(this, function(evt,multipleResults) {
                    this.sidePanel.handleClickMultipleResults(evt, multipleResults);
                }));


                topic.subscribe("slides/layer-click", lang.hitch(this, function(lyrInfo) {
                    this.sidePanel.populatePOI(lyrInfo);
                }));


                topic.subscribe("changeSlide-zoom", lang.hitch(this, function(slideName, evt) {
                    this.sidePanel.slideCard.resetSlideLayers(slideName).then(lang.hitch(this, function(flg) {
                        if (flg) {
                            topic.publish("slideCard/slideChanged", slideName);
                            this.sceneController.setSelectedFeatureSymbology(evt);
                        }
                    }));
                }));

                topic.subscribe("slideCard/slideChanged", lang.hitch(this, function(slideName) {
                    this.sceneController.updateCurrentSlide(slideName);
                    this.sceneController.defaultRendering(slideName);
                    this.floorPicker.enableFloorPicker(true);

                }));

                topic.subscribe("slideBtn/click", lang.hitch(this, function() {
                    this.sidePanel.close('clear');
                }));


                if (this.routingEnabled) {

                  topic.subscribe("route/solve", lang.hitch(this, function(startInfo, destinationInfo, elevator) {
                    this.sceneController.clearHighlights();
                    this.sceneController.clearRouteSpaceHighlights();
                    this.route.startRouting(startInfo, destinationInfo, elevator);
                  }));

                  topic.subscribe("route/complete", lang.hitch(this, function(attr, bldgFlrs, highlights) {
                      this.sidePanel.populateRouteInfo(attr);
                      this.sceneController.appyDefExp(bldgFlrs);
                      this.sceneController.addRouteSpaceHighlights(highlights);
                      this.floorPicker.enableFloorPicker(false);
                  }));

                  topic.subscribe("route/error", lang.hitch(this, function() {
                      this.sidePanel.populateRouteInfo(null);
                  }));

                  topic.subscribe("route/close", lang.hitch(this, function() {
                    topic.publish("route/clear");
                    this.sceneController.clearRouteSpaceHighlights();
                    this.floorPicker.enableFloorPicker(true);
                    topic.publish("floorPicker/switchFloors", 'All');
                }));

                topic.subscribe("route/clear", lang.hitch(this, function() {
                  this.route.clearRouting();
                  this.sceneController.clearHighlights();
                  this.sceneController.clearAllGraphics();
                }));

                topic.subscribe("clear-nonRoute-graphics", lang.hitch(this, function(gphLyrId) {
                  // filteredLayers is a Collection of graphic layers
                  var filteredLayers = this.view.map.layers.filter(function(lyr){
                    return (!lyr.operationalLayerType); //graphic layers does not have 'operationalLayerType'
                  });

                  console.log(filteredLayers);

                  filteredLayers.forEach(function(gphLyr) {
                    if (gphLyr.id !== gphLyrId) {
                        gphLyr.removeAll();
                    }
                  });
                }));
              }
            }
        };

    });
